import { createHash, randomUUID } from "node:crypto";

import type { BBox, CorpusRecord, CorpusSnapshot } from "@/types/corpus";
import type { GeoGeometry } from "@/types/geo";
import { bbox as bboxOf, geometryHash } from "@/lib/geo/measure";
import { arcgisConfig, SOURCE_DEFINITIONS } from "@/lib/sources/config";
import { ArcGisError, countArcGisRecords, queryArcGisPage } from "@/lib/sources/arcgis";
import { getCorpusStore } from "./store";
import { bboxUnion, periodOf } from "./period";

/**
 * Harvesting a source into a dated snapshot.
 *
 * The harvest is resumable by design. A national cadastre does not fit in one
 * serverless invocation, so each run works against a time budget, persists how
 * far it got, and lets the next run continue. A snapshot only becomes ACTIVE
 * once the whole layer has been read — a half-read month would quietly under-
 * report overlaps, which is exactly the failure this product cannot have.
 */

/** Sources harvestable as whole layers. REINFO and Copernicus stay live-only:
 *  one is a per-identifier lookup, the other a rolling scene catalogue. */
export const HARVESTABLE_SOURCES = ["ingemmet", "sernanp", "ana", "bdpi"] as const;
export type HarvestableSource = (typeof HARVESTABLE_SOURCES)[number];

export function isHarvestable(sourceKey: string): sourceKey is HarvestableSource {
  return (HARVESTABLE_SOURCES as readonly string[]).includes(sourceKey);
}

export function layerUrlFor(sourceKey: string): string | undefined {
  switch (sourceKey) {
    case "ingemmet":
      return arcgisConfig.ingemmet.layerUrl;
    case "sernanp":
      return arcgisConfig.sernanp.layerUrl;
    case "ana":
      return arcgisConfig.ana.layerUrl;
    case "bdpi":
      return arcgisConfig.bdpi.layerUrl;
    default:
      return undefined;
  }
}

/** Deterministic JSON so a checksum reflects content, not key ordering. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function recordChecksum(
  attributes: Record<string, unknown>,
  geometry: GeoGeometry | null,
): string {
  const geo = geometry ? geometryHash(geometry) : "no-geometry";
  return createHash("sha256")
    .update(`${stableStringify(attributes)}::${geo}`)
    .digest("hex")
    .slice(0, 32);
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

/**
 * Maps a raw feature onto the same attribute names the adapters already use, so
 * a corpus-backed assessment and a live one produce identical record shapes.
 */
function normalizeAttributes(
  sourceKey: string,
  raw: Record<string, unknown>,
): { externalId: string | null; attributes: Record<string, unknown> } {
  if (sourceKey === "ingemmet") {
    const f = arcgisConfig.ingemmet.fields;
    const code = firstString(raw, [f.code]);
    const hectares = raw[f.hectares];
    return {
      externalId: code,
      attributes: {
        code,
        name: firstString(raw, [f.name]),
        status: firstString(raw, [f.status]),
        holder: firstString(raw, [f.holder]),
        substance: firstString(raw, [f.substance]),
        declaredHectares: typeof hectares === "number" ? hectares : Number(hectares) || null,
        raw,
      },
    };
  }

  if (sourceKey === "sernanp") {
    const f = arcgisConfig.sernanp.fields;
    const name = firstString(raw, [f.name]);
    return {
      externalId: name,
      attributes: {
        name,
        category: firstString(raw, [f.category]),
        legalNorm: firstString(raw, [f.legalNorm]),
        establishedAt: firstString(raw, [f.establishedAt]),
        raw,
      },
    };
  }

  // Unmapped sources are stored verbatim. Nothing downstream invents structure
  // the deployment has not configured.
  return {
    externalId: firstString(raw, ["OBJECTID", "objectid", "FID", "id"]),
    attributes: { raw },
  };
}

export interface HarvestOptions {
  sourceKey: string;
  /** Defaults to the current calendar month. */
  period?: string;
  pageSize?: number;
  /** Wall-clock budget for this invocation. The harvest resumes on the next. */
  budgetMs?: number;
  /** Hard cap on pages per invocation, independent of the time budget. */
  maxPages?: number;
}

export interface HarvestResult {
  sourceKey: string;
  period: string;
  snapshotId: string | null;
  status: CorpusSnapshot["status"] | "SKIPPED";
  recordsWritten: number;
  totalRecords: number;
  /** True when the layer was read to the end and the snapshot went ACTIVE. */
  complete: boolean;
  message: string;
}

const DEFAULT_PAGE_SIZE = Number(process.env.CORPUS_PAGE_SIZE ?? 1000);
const DEFAULT_BUDGET_MS = Number(process.env.CORPUS_BUDGET_MS ?? 45_000);

/**
 * Harvests one source for one period, resuming an in-progress snapshot when one
 * exists. Returns without touching the ACTIVE snapshot if the source is not
 * configured — a missing layer URL is reported, never silently skipped as "no
 * records found".
 */
export async function harvestSource(options: HarvestOptions): Promise<HarvestResult> {
  const { sourceKey } = options;
  const period = options.period ?? periodOf();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const deadline = Date.now() + budgetMs;

  const base: Omit<HarvestResult, "status" | "message" | "complete"> = {
    sourceKey,
    period,
    snapshotId: null,
    recordsWritten: 0,
    totalRecords: 0,
  };

  if (!isHarvestable(sourceKey)) {
    return {
      ...base,
      status: "SKIPPED",
      complete: false,
      message: `${sourceKey} is queried live and has no harvestable layer.`,
    };
  }

  const layerUrl = layerUrlFor(sourceKey);
  if (!layerUrl) {
    return {
      ...base,
      status: "SKIPPED",
      complete: false,
      message: `No layer URL configured for ${sourceKey}. Set the corresponding *_LAYER_URL variable.`,
    };
  }

  const store = await getCorpusStore();
  let snapshot = await store.findSnapshot(sourceKey, period);

  if (snapshot?.status === "ACTIVE") {
    return {
      ...base,
      snapshotId: snapshot.id,
      status: "ACTIVE",
      complete: true,
      totalRecords: snapshot.recordCount,
      message: `${period} is already built for ${sourceKey}.`,
    };
  }

  if (!snapshot) {
    snapshot = await store.createSnapshot({
      id: randomUUID(),
      sourceKey,
      period,
      status: "BUILDING",
      layerUrl,
      startedAt: new Date().toISOString(),
      completedAt: null,
      recordCount: 0,
      checksum: null,
      coverage: null,
      cursor: 0,
      warnings: [],
    });
  }

  const expected = await countArcGisRecords(layerUrl);
  let offset = snapshot.cursor;
  let written = 0;
  let pages = 0;
  let exhausted = false;
  const boxes: BBox[] = snapshot.coverage ? [snapshot.coverage] : [];
  const warnings = [...snapshot.warnings];

  while (Date.now() < deadline && pages < maxPages) {
    let page;
    try {
      page = await queryArcGisPage({ layerUrl, offset, pageSize });
    } catch (error) {
      const message = error instanceof ArcGisError ? error.message : String(error);
      warnings.push(`Harvest interrupted at offset ${offset}: ${message}`);
      await store.updateSnapshot(snapshot.id, { cursor: offset, warnings });
      return {
        ...base,
        snapshotId: snapshot.id,
        status: "BUILDING",
        complete: false,
        recordsWritten: written,
        totalRecords: expected ?? 0,
        message: `Paused after ${written} record(s): ${message}`,
      };
    }

    if (page.features.length === 0) {
      exhausted = true;
      break;
    }

    const batch: CorpusRecord[] = [];
    for (const feature of page.features) {
      const { externalId, attributes } = normalizeAttributes(sourceKey, feature.attributes);
      const box = feature.geometry ? (bboxOf(feature.geometry) as BBox) : null;
      if (box) boxes.push(box);
      batch.push({
        snapshotId: snapshot.id,
        sourceKey,
        // A feature the source did not identify still has to be storable, and a
        // content hash keeps it stable across harvests instead of duplicating.
        externalId: externalId ?? `anon:${recordChecksum(attributes, feature.geometry)}`,
        geometry: feature.geometry,
        bbox: box,
        attributes,
        checksum: recordChecksum(attributes, feature.geometry),
      });
    }

    await store.putRecords(batch);
    written += batch.length;
    offset += page.features.length;
    pages += 1;

    await store.updateSnapshot(snapshot.id, {
      cursor: offset,
      recordCount: offset,
      coverage: bboxUnion(boxes),
    });

    if (!page.exceededTransferLimit && page.features.length < pageSize) {
      exhausted = true;
      break;
    }
  }

  if (!exhausted) {
    return {
      ...base,
      snapshotId: snapshot.id,
      status: "BUILDING",
      complete: false,
      recordsWritten: written,
      totalRecords: expected ?? offset,
      message: `Harvested ${offset} of ${expected ?? "unknown"} record(s) for ${sourceKey} ${period}. Resumes on the next run.`,
    };
  }

  const finalized = await finalizeSnapshot(snapshot.id);
  return {
    ...base,
    snapshotId: snapshot.id,
    status: "ACTIVE",
    complete: true,
    recordsWritten: written,
    totalRecords: finalized.recordCount,
    message: `${sourceKey} ${period} is active with ${finalized.recordCount} record(s).`,
  };
}

/**
 * Seals a snapshot: computes the content checksum and promotes it to ACTIVE.
 *
 * The checksum is taken over the sorted per-record checksums, so it is stable
 * regardless of harvest order and identical when a month brought no changes.
 */
export async function finalizeSnapshot(snapshotId: string): Promise<CorpusSnapshot> {
  const store = await getCorpusStore();
  const records = await store.allRecords(snapshotId);
  const digest = createHash("sha256");
  for (const checksum of records.map((r) => `${r.externalId}:${r.checksum}`).sort()) {
    digest.update(checksum);
  }

  const boxes = records.map((r) => r.bbox).filter((b): b is BBox => b !== null);

  const updated = await store.updateSnapshot(snapshotId, {
    status: "ACTIVE",
    completedAt: new Date().toISOString(),
    recordCount: records.length,
    checksum: digest.digest("hex").slice(0, 32),
    coverage: bboxUnion(boxes),
  });
  await store.activate(snapshotId);
  return updated;
}

/** Runs a harvest pass across every configured source. Used by the monthly cron. */
export async function harvestAll(options: Omit<HarvestOptions, "sourceKey"> = {}): Promise<HarvestResult[]> {
  const results: HarvestResult[] = [];
  for (const sourceKey of HARVESTABLE_SOURCES) {
    if (!SOURCE_DEFINITIONS[sourceKey]) continue;
    results.push(await harvestSource({ ...options, sourceKey }));
  }
  return results;
}
