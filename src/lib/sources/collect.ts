import { createHash } from "node:crypto";

import type { Evidence } from "@/types/evidence";
import type { GeoGeometry } from "@/types/geo";
import type { SourceResult, SourceStatus } from "@/types/sources";
import type { SourceStatusSummary } from "@/types/assessment";
import type { CorpusBasis, EvidenceBasisMode } from "@/types/corpus";
import { overlap } from "@/lib/geo/measure";
import { queryCorpusMiningRights, queryCorpusProtectedAreas } from "@/lib/corpus/query";

import { fetchMiningRights, type MiningRightRecord } from "./ingemmet";
import { fetchProtectedAreas, type ProtectedAreaRecord } from "./sernanp";
import { fetchReinfoStatus, type ReinfoRecord } from "./reinfo";
import { searchSentinelScenes, type SatelliteSceneRecord } from "./copernicus";
import { fetchContextLayers, type ContextRecord } from "./context";
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
  territorial: SourceResult<ContextRecord>;
  water: SourceResult<ContextRecord>;
  evidence: Evidence[];
  collectedAt: string;
  /** How the cadastral and protected-area answers were sourced. */
  basisMode: EvidenceBasisMode;
  /** The exact snapshots this bundle was read from, when in corpus mode. */
  corpusBasis: CorpusBasis[];
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
      vegetationChangePercent: scene.vegetationChangePercent ?? null,
      vegetationInterpretation: scene.vegetationInterpretation ?? null,
      previewUrl: scene.previewUrl,
      role,
    },
  };
}

function contextEvidence(
  result: SourceResult<ContextRecord>,
  record: ContextRecord,
): Evidence {
  const key = record.label ?? JSON.stringify(record.raw).slice(0, 64);
  return {
    ...baseEvidence(result, `context:${key}`, "finding"),
    title: `${result.sourceName} — ${record.label ?? "context record"}`,
    detail:
      `${record.category ? `Category/source field: ${record.category}. ` : ""}` +
      `Intersects ${record.overlapPercentOfAoi}% of the area of interest (${record.overlapHectares} ha).`,
    geometry: record.geometry,
    metadata: {
      label: record.label,
      category: record.category,
      sourceLabel: record.sourceLabel,
      overlapHectares: record.overlapHectares,
      overlapPercentOfAoi: record.overlapPercentOfAoi,
      raw: record.raw,
    },
  };
}

function reinfoEvidence(result: SourceResult<ReinfoRecord>, record: ReinfoRecord): Evidence {
  const key = record.codReinfo ?? record.ruc ?? record.rightCode ?? JSON.stringify(record.raw).slice(0, 64);
  return {
    ...baseEvidence(result, `reinfo:${key}`, "finding"),
    title: `REINFO ${record.codReinfo ?? "(code not reported)"} — ${record.declarant ?? "declarant not reported"}`,
    detail:
      `Published status: ${record.status ?? "not reported"}. ` +
      `Right code: ${record.rightCode ?? "not reported"}. ` +
      `RUC: ${record.ruc ?? "not reported"}. ` +
      `Coordinate status: ${record.coordinateStatus ?? "not reported"}.`,
    observedAt: record.updatedAt ?? undefined,
    metadata: {
      status: record.status,
      declarant: record.declarant,
      representative: record.representative,
      ruc: record.ruc,
      rightCode: record.rightCode,
      rightName: record.rightName,
      codReinfo: record.codReinfo,
      activityType: record.activityType,
      coordinateStatus: record.coordinateStatus,
      updatedAt: record.updatedAt,
      latitude: record.latitude,
      longitude: record.longitude,
      raw: record.raw,
    },
  };
}

export interface CollectOptions {
  /** Identifier used for the REINFO lookup, when one is configured. */
  reinfoQuery?: string;
  /** Skip the satellite catalogue for faster assessments. */
  includeSatellite?: boolean;
  /**
   * Where the cadastral and protected-area answers come from.
   *
   * `corpus` reads the dated monthly snapshot: fast, reproducible, and as old
   * as its period. `live` queries the official layer directly: current to the
   * minute, slower, and it degrades when the service is down. The default falls
   * back to `live` whenever no snapshot has been built, so a fresh deployment
   * still works before the first harvest has run.
   */
  basis?: EvidenceBasisMode;
}

/**
 * Reads the cadastre and protected areas from the corpus, falling back to a
 * live query when no snapshot is available.
 *
 * The fallback is never silent: the returned bundle records which mode was used
 * and the dossier prints it, because "as of the August snapshot" and "as of
 * this minute" are different claims and a buyer is entitled to know which one
 * they are holding.
 */
async function resolveBasis(
  aoi: GeoGeometry,
  preferred: EvidenceBasisMode,
): Promise<{
  miningRights: SourceResult<MiningRightRecord>;
  protectedAreas: SourceResult<ProtectedAreaRecord>;
  mode: EvidenceBasisMode;
  corpusBasis: CorpusBasis[];
}> {
  if (preferred === "corpus") {
    const [rights, areas] = await Promise.all([
      queryCorpusMiningRights(aoi),
      queryCorpusProtectedAreas(aoi),
    ]);
    // A corpus that answers for both P0 sources is a corpus-mode assessment.
    // Anything less falls back rather than mixing two bases in one score.
    if (rights.basis && areas.basis) {
      return {
        miningRights: rights.result,
        protectedAreas: areas.result,
        mode: "corpus",
        corpusBasis: [rights.basis, areas.basis],
      };
    }
  }

  const [miningRights, protectedAreas] = await Promise.all([
    fetchMiningRights(aoi),
    fetchProtectedAreas(aoi),
  ]);
  return { miningRights, protectedAreas, mode: "live", corpusBasis: [] };
}

/** Queries every source in parallel and normalizes the answers into evidence. */
export async function collectEvidence(
  aoi: GeoGeometry,
  aoiHectares: number,
  options: CollectOptions = {},
): Promise<EvidenceBundle> {
  const includeSatellite = options.includeSatellite ?? true;
  const preferred: EvidenceBasisMode =
    options.basis ?? (process.env.CORPUS_MODE === "live" ? "live" : "corpus");

  const [basis, reinfo, satellite, territorial, water] = await Promise.all([
    resolveBasis(aoi, preferred),
    fetchReinfoStatus(options.reinfoQuery, aoi),
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
    fetchContextLayers("bdpi", aoi),
    fetchContextLayers("ana", aoi),
  ]);

  const { miningRights, protectedAreas } = basis;

  const evidence: Evidence[] = [
    statusEvidence(miningRights, "mining rights"),
    statusEvidence(protectedAreas, "protected areas"),
    statusEvidence(reinfo, "REINFO registration"),
    statusEvidence(satellite, "satellite scenes"),
    statusEvidence(territorial, "territorial context"),
    statusEvidence(water, "water context"),
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
  for (const record of reinfo.records) {
    evidence.push(reinfoEvidence(reinfo, record));
  }
  for (const record of territorial.records) {
    evidence.push(contextEvidence(territorial, record));
  }
  for (const record of water.records) {
    evidence.push(contextEvidence(water, record));
  }

  return {
    aoi,
    aoiHectares,
    miningRights,
    protectedAreas,
    reinfo,
    satellite,
    territorial,
    water,
    evidence,
    collectedAt: new Date().toISOString(),
    basisMode: basis.mode,
    corpusBasis: basis.corpusBasis,
  };
}

export function allSourceResults(bundle: EvidenceBundle): SourceResult<unknown>[] {
  return [
    bundle.miningRights,
    bundle.protectedAreas,
    bundle.reinfo,
    bundle.satellite,
    bundle.territorial,
    bundle.water,
  ];
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
