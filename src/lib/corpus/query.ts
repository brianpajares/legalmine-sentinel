import type { BBox, CorpusBasis, CorpusRecord } from "@/types/corpus";
import type { GeoGeometry } from "@/types/geo";
import type { SourceResult, SourceStatus } from "@/types/sources";
import type { MiningRightRecord } from "@/lib/sources/ingemmet";
import type { ProtectedAreaRecord } from "@/lib/sources/sernanp";
import { bbox as bboxOf, overlap } from "@/lib/geo/measure";
import { SOURCE_DEFINITIONS } from "@/lib/sources/config";
import { getCorpusStore } from "./store";
import { bboxIntersects, periodLabel, periodOf, previousPeriod } from "./period";

/**
 * Reading the corpus for one area of interest.
 *
 * Two-stage filter: a bounding-box prefilter that never deserializes a polygon
 * it can rule out, then an exact turf intersection on what survives. On a
 * national cadastre the prefilter is what makes this fast enough to be
 * interactive.
 */

export interface CorpusQuery<T> {
  result: SourceResult<T>;
  basis: CorpusBasis | null;
}

/** A snapshot is current for the month it covers and the one after it; beyond
 *  that the monthly cadence has slipped and the report must say so. */
function statusForPeriod(period: string): SourceStatus {
  const now = periodOf();
  return period === now || period === previousPeriod(now) ? "OK" : "STALE";
}

function notConfigured<T>(sourceKey: string, reason: string): CorpusQuery<T> {
  const definition = SOURCE_DEFINITIONS[sourceKey];
  return {
    basis: null,
    result: {
      sourceKey,
      sourceName: definition?.name ?? sourceKey,
      official: definition?.official ?? false,
      tier: "official",
      status: "NOT_CONFIGURED",
      fetchedAt: new Date().toISOString(),
      records: [],
      warnings: [reason],
    },
  };
}

async function candidatesFor(
  sourceKey: string,
  aoi: GeoGeometry,
): Promise<{ records: CorpusRecord[]; basis: CorpusBasis; status: SourceStatus } | null> {
  const store = await getCorpusStore();
  const snapshot = await store.activeSnapshot(sourceKey);
  if (!snapshot) return null;

  const box = bboxOf(aoi) as BBox;
  const inBox = await store.recordsInBBox(snapshot.id, box);
  const records = inBox.filter((r) => r.bbox === null || bboxIntersects(r.bbox, box));

  return {
    records,
    status: statusForPeriod(snapshot.period),
    basis: {
      sourceKey,
      period: snapshot.period,
      snapshotId: snapshot.id,
      checksum: snapshot.checksum,
      ingestedAt: snapshot.completedAt ?? snapshot.startedAt,
      recordCount: snapshot.recordCount,
    },
  };
}

function corpusWarnings(basis: CorpusBasis, status: SourceStatus, ephemeral: boolean): string[] {
  const warnings = [
    `Answered from the ${periodLabel(basis.period)} snapshot (${basis.recordCount} records), not a live query.`,
  ];
  if (status === "STALE") {
    warnings.push(
      `That snapshot is older than one month. The monthly refresh has not run since ${basis.period}.`,
    );
  }
  if (ephemeral) {
    warnings.push(
      "This corpus is held in process memory and is lost on restart, so it cannot back a reproducibility claim yet.",
    );
  }
  return warnings;
}

export async function queryCorpusMiningRights(
  aoi: GeoGeometry,
): Promise<CorpusQuery<MiningRightRecord>> {
  const sourceKey = "ingemmet";
  const found = await candidatesFor(sourceKey, aoi);
  if (!found) {
    return notConfigured(sourceKey, "No active corpus snapshot for the mining cadastre.");
  }

  const store = await getCorpusStore();
  const definition = SOURCE_DEFINITIONS[sourceKey];
  const records: MiningRightRecord[] = [];

  for (const record of found.records) {
    if (!record.geometry) continue;
    const hit = overlap(aoi, record.geometry);
    if (hit.areaHectares <= 0) continue;
    const attrs = record.attributes as Record<string, unknown>;
    records.push({
      code: (attrs.code as string) ?? null,
      name: (attrs.name as string) ?? null,
      status: (attrs.status as string) ?? null,
      holder: (attrs.holder as string) ?? null,
      substance: (attrs.substance as string) ?? null,
      declaredHectares: (attrs.declaredHectares as number) ?? null,
      overlapHectares: hit.areaHectares,
      overlapPercentOfAoi: hit.percentOfAoi,
      geometry: record.geometry,
      raw: (attrs.raw as Record<string, unknown>) ?? {},
    });
  }

  records.sort((a, b) => b.overlapHectares - a.overlapHectares);

  return {
    basis: found.basis,
    result: {
      sourceKey,
      sourceName: definition.name,
      official: definition.official,
      tier: "official",
      status: found.status,
      fetchedAt: new Date().toISOString(),
      validAt: found.basis.ingestedAt,
      sourceUrl: definition.portalUrl,
      records,
      warnings: corpusWarnings(found.basis, found.status, store.ephemeral),
      rawChecksum: found.basis.checksum ?? undefined,
    },
  };
}

export async function queryCorpusProtectedAreas(
  aoi: GeoGeometry,
): Promise<CorpusQuery<ProtectedAreaRecord>> {
  const sourceKey = "sernanp";
  const found = await candidatesFor(sourceKey, aoi);
  if (!found) {
    return notConfigured(sourceKey, "No active corpus snapshot for protected areas.");
  }

  const store = await getCorpusStore();
  const definition = SOURCE_DEFINITIONS[sourceKey];
  const records: ProtectedAreaRecord[] = [];

  for (const record of found.records) {
    if (!record.geometry) continue;
    const hit = overlap(aoi, record.geometry);
    if (hit.areaHectares <= 0) continue;
    const attrs = record.attributes as Record<string, unknown>;
    records.push({
      name: (attrs.name as string) ?? null,
      category: (attrs.category as string) ?? null,
      legalNorm: (attrs.legalNorm as string) ?? null,
      establishedAt: (attrs.establishedAt as string) ?? null,
      overlapHectares: hit.areaHectares,
      overlapPercentOfAoi: hit.percentOfAoi,
      geometry: record.geometry,
      raw: (attrs.raw as Record<string, unknown>) ?? {},
    });
  }

  records.sort((a, b) => b.overlapHectares - a.overlapHectares);

  return {
    basis: found.basis,
    result: {
      sourceKey,
      sourceName: definition.name,
      official: definition.official,
      tier: "official",
      status: found.status,
      fetchedAt: new Date().toISOString(),
      validAt: found.basis.ingestedAt,
      sourceUrl: definition.portalUrl,
      records,
      warnings: corpusWarnings(found.basis, found.status, store.ephemeral),
      rawChecksum: found.basis.checksum ?? undefined,
    },
  };
}

/** Records from the active snapshot whose bbox meets the AOI, used by the
 *  monthly change report rather than by scoring. */
export async function corpusRecordsForAoi(
  sourceKey: string,
  aoi: GeoGeometry,
): Promise<CorpusRecord[]> {
  const found = await candidatesFor(sourceKey, aoi);
  return found?.records ?? [];
}
