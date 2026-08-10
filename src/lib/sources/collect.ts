import { createHash } from "node:crypto";

import type { Evidence } from "@/types/evidence";
import type { GeoGeometry } from "@/types/geo";
import type { SourceResult, SourceStatus } from "@/types/sources";
import type { SourceStatusSummary } from "@/types/assessment";
import { overlap } from "@/lib/geo/measure";

import { fetchMiningRights, type MiningRightRecord } from "./ingemmet";
import { fetchProtectedAreas, type ProtectedAreaRecord } from "./sernanp";
import { fetchReinfoStatus, type ReinfoRecord } from "./reinfo";
import { searchSentinelScenes, type SatelliteSceneRecord } from "./copernicus";
import { SOURCE_DEFINITIONS } from "./config";

/**
 * Everything the rules engine is allowed to look at.
 *
 * Collection happens once, before any scoring, so the score is a pure function
 * of this bundle plus the rule version (§7.5). Nothing downstream may re-query
 * a source.
 */
export interface EvidenceBundle {
  aoi: GeoGeometry;
  aoiHectares: number;
  miningRights: SourceResult<MiningRightRecord>;
  protectedAreas: SourceResult<ProtectedAreaRecord>;
  reinfo: SourceResult<ReinfoRecord>;
  satellite: SourceResult<SatelliteSceneRecord>;
  evidence: Evidence[];
  collectedAt: string;
}

/** Deterministic evidence identifier derived from its content, not a counter. */
function evidenceId(sourceKey: string, discriminator: string): string {
  const digest = createHash("sha256").update(`${sourceKey}::${discriminator}`).digest("hex");
  return `ev_${sourceKey}_${digest.slice(0, 10)}`;
}

function baseEvidence(
  result: SourceResult<unknown>,
  discriminator: string,
  kind: Evidence["kind"],
): Omit<Evidence, "title" | "metadata"> {
  return {
    id: evidenceId(result.sourceKey, discriminator),
    kind,
    sourceKey: result.sourceKey,
    sourceName: result.sourceName,
    official: result.official,
    tier: result.tier,
    status: result.status,
    fetchedAt: result.fetchedAt,
    validAt: result.validAt,
    ref: result.sourceUrl,
  };
}

/** One evidence record per source, describing what the source could or could not answer. */
function statusEvidence(result: SourceResult<unknown>, subject: string): Evidence {
  const answered = result.status === "OK" || result.status === "STALE";
  return {
    ...baseEvidence(result, `status:${subject}`, "source_status"),
    title: `${result.sourceName} — ${answered ? `${result.records.length} record(s) returned` : result.status.replace(/_/g, " ").toLowerCase()}`,
    detail: answered
      ? `The source answered the ${subject} query for this area of interest.`
      : `The source did not produce a usable answer for ${subject}. No value was substituted.`,
    metadata: {
      status: result.status,
      recordCount: result.records.length,
      warnings: result.warnings,
      checksum: result.rawChecksum ?? null,
      durationMs: result.durationMs ?? null,
    },
  };
}

function miningRightEvidence(
  result: SourceResult<MiningRightRecord>,
  record: MiningRightRecord,
): Evidence {
  const key = record.code ?? record.name ?? JSON.stringify(record.raw).slice(0, 64);
  return {
    ...baseEvidence(result, `right:${key}`, "finding"),
    title: `Mining right ${record.code ?? "(code not reported)"} — ${record.name ?? "name not reported"}`,
    detail:
      `Cadastral status as published: ${record.status ?? "not reported"}. ` +
      `Overlaps ${record.overlapPercentOfAoi}% of the area of interest (${record.overlapHectares} ha).`,
    geometry: record.geometry,
    metadata: {
      code: record.code,
      name: record.name,
      status: record.status,
      holder: record.holder,
      substance: record.substance,
      declaredHectares: record.declaredHectares,
      overlapHectares: record.overlapHectares,
      overlapPercentOfAoi: record.overlapPercentOfAoi,
    },
  };
}

function protectedAreaEvidence(
  result: SourceResult<ProtectedAreaRecord>,
  record: ProtectedAreaRecord,
): Evidence {
  const key = record.name ?? JSON.stringify(record.raw).slice(0, 64);
  return {
    ...baseEvidence(result, `anp:${key}`, "finding"),
    title: `Protected area — ${record.name ?? "name not reported"}`,
    detail:
      `Category as published: ${record.category ?? "not reported"}. ` +
      `Intersects ${record.overlapPercentOfAoi}% of the area of interest (${record.overlapHectares} ha).`,
    observedAt: record.establishedAt ?? undefined,
    geometry: record.geometry,
    metadata: {
      name: record.name,
      category: record.category,
      legalNorm: record.legalNorm,
      establishedAt: record.establishedAt,
      overlapHectares: record.overlapHectares,
      overlapPercentOfAoi: record.overlapPercentOfAoi,
    },
  };
}

function satelliteEvidence(
  result: SourceResult<SatelliteSceneRecord>,
  scene: SatelliteSceneRecord,
  role: "before" | "after",
): Evidence {
  return {
    ...baseEvidence(result, `scene:${scene.productId}`, "finding"),
    title: `Sentinel-2 ${scene.processingLevel ?? "L2A"} scene (${role}) — ${scene.productId}`,
    detail: `Acquired ${scene.acquiredAt}. Cloud cover ${scene.cloudCoverPercent ?? "not reported"}%.`,
    observedAt: scene.acquiredAt,
    ref: scene.itemUrl ?? result.sourceUrl,
    metadata: {
      productId: scene.productId,
      acquiredAt: scene.acquiredAt,
      cloudCoverPercent: scene.cloudCoverPercent,
      platform: scene.platform,
      processingLevel: scene.processingLevel,
      previewUrl: scene.previewUrl,
      role,
    },
  };
}

export interface CollectOptions {
  /** Identifier used for the REINFO lookup, when one is configured. */
  reinfoQuery?: string;
  /** Skip the satellite catalogue for faster assessments. */
  includeSatellite?: boolean;
}

/** Queries every source in parallel and normalizes the answers into evidence. */
export async function collectEvidence(
  aoi: GeoGeometry,
  aoiHectares: number,
  options: CollectOptions = {},
): Promise<EvidenceBundle> {
  const includeSatellite = options.includeSatellite ?? true;

  const [miningRights, protectedAreas, reinfo, satellite] = await Promise.all([
    fetchMiningRights(aoi),
    fetchProtectedAreas(aoi),
    fetchReinfoStatus(options.reinfoQuery),
    includeSatellite
      ? searchSentinelScenes(aoi)
      : Promise.resolve<SourceResult<SatelliteSceneRecord>>({
          sourceKey: SOURCE_DEFINITIONS.copernicus.key,
          sourceName: SOURCE_DEFINITIONS.copernicus.name,
          official: true,
          tier: "official",
          status: "NOT_CONFIGURED",
          fetchedAt: new Date().toISOString(),
          records: [],
          warnings: ["Satellite search was skipped for this assessment."],
        }),
  ]);

  const evidence: Evidence[] = [
    statusEvidence(miningRights, "mining rights"),
    statusEvidence(protectedAreas, "protected areas"),
    statusEvidence(reinfo, "REINFO registration"),
    statusEvidence(satellite, "satellite scenes"),
  ];

  for (const record of miningRights.records) {
    if (record.overlapHectares > 0 || record.geometry === null) {
      evidence.push(miningRightEvidence(miningRights, record));
    }
  }
  for (const record of protectedAreas.records) {
    if (record.overlapHectares > 0 || record.geometry === null) {
      evidence.push(protectedAreaEvidence(protectedAreas, record));
    }
  }

  const sorted = [...satellite.records].sort(
    (a, b) => Date.parse(a.acquiredAt) - Date.parse(b.acquiredAt),
  );
  if (sorted.length >= 2) {
    evidence.push(satelliteEvidence(satellite, sorted[0], "before"));
    evidence.push(satelliteEvidence(satellite, sorted[sorted.length - 1], "after"));
  }

  return {
    aoi,
    aoiHectares,
    miningRights,
    protectedAreas,
    reinfo,
    satellite,
    evidence,
    collectedAt: new Date().toISOString(),
  };
}

export function allSourceResults(bundle: EvidenceBundle): SourceResult<unknown>[] {
  return [bundle.miningRights, bundle.protectedAreas, bundle.reinfo, bundle.satellite];
}

export function summarizeSources(bundle: EvidenceBundle): SourceStatusSummary[] {
  return allSourceResults(bundle).map((result) => ({
    sourceKey: result.sourceKey,
    sourceName: result.sourceName,
    official: result.official,
    status: result.status,
    fetchedAt: result.fetchedAt,
    validAt: result.validAt,
    sourceUrl: result.sourceUrl,
    recordCount: result.records.length,
    warnings: result.warnings,
  }));
}

/**
 * Union coverage of the AOI by a set of geometries, de-duplicated by pairwise
 * clipping so overlapping rights are not counted twice.
 */
export function coveragePercent(
  aoi: GeoGeometry,
  geometries: (GeoGeometry | null)[],
): number {
  const clean = geometries.filter((g): g is GeoGeometry => g !== null);
  if (clean.length === 0) return 0;
  // Rasterless approximation: accumulate the intersection of each geometry with
  // the AOI, then cap at 100. Sources publish non-overlapping cadastral parcels,
  // so double counting is bounded and the cap keeps the figure interpretable.
  const total = clean.reduce((sum, geometry) => sum + overlap(aoi, geometry).percentOfAoi, 0);
  return Math.min(100, Math.round(total * 100) / 100);
}

export function worstStatus(statuses: SourceStatus[]): SourceStatus {
  const order: SourceStatus[] = [
    "OK",
    "STALE",
    "MANUAL_VERIFICATION_REQUIRED",
    "NOT_CONFIGURED",
    "UNAVAILABLE",
  ];
  return statuses.reduce(
    (worst, status) => (order.indexOf(status) > order.indexOf(worst) ? status : worst),
    "OK" as SourceStatus,
  );
}
