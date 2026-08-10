import { randomUUID } from "node:crypto";

import type {
  BBox,
  CorpusChange,
  CorpusRecord,
  WatchReport,
  WatchSubscription,
} from "@/types/corpus";
import type { GeoGeometry } from "@/types/geo";
import { bbox as bboxOf, overlap } from "@/lib/geo/measure";
import { SOURCE_DEFINITIONS } from "@/lib/sources/config";
import { getCorpusStore } from "./store";
import { HARVESTABLE_SOURCES } from "./ingest";
import { bboxIntersects, periodLabel, periodOf, previousPeriod } from "./period";

/**
 * What changed between two months.
 *
 * This is the difference between a report and a subscription. A one-off
 * screening answers "what is true today"; the monthly delta answers "what moved
 * since you last looked", which is the question an operator has to keep asking
 * and the only one worth paying for every month.
 */

/** Attributes compared field by field. `raw` is excluded: it carries service
 *  bookkeeping like OBJECTID that changes without the record changing. */
function comparableAttributes(record: CorpusRecord): Record<string, unknown> {
  const { raw: _raw, ...rest } = record.attributes as Record<string, unknown>;
  void _raw;
  return rest;
}

function changedFieldsBetween(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
      changed.push(key);
    }
  }
  return changed.sort();
}

/**
 * Diffs the snapshots of one source across two periods.
 *
 * Returns an empty list when either period is missing rather than reporting
 * every record as added — a month we never harvested is unknown, not empty.
 */
export async function diffSnapshots(
  sourceKey: string,
  period: string,
  previous = previousPeriod(period),
): Promise<CorpusChange[]> {
  const store = await getCorpusStore();
  const [current, prior] = await Promise.all([
    store.findSnapshot(sourceKey, period),
    store.findSnapshot(sourceKey, previous),
  ]);
  if (!current || !prior) return [];
  if (current.checksum && current.checksum === prior.checksum) return [];

  const [currentRecords, priorRecords] = await Promise.all([
    store.allRecords(current.id),
    store.allRecords(prior.id),
  ]);

  const priorById = new Map(priorRecords.map((r) => [r.externalId, r]));
  const changes: CorpusChange[] = [];

  for (const record of currentRecords) {
    const before = priorById.get(record.externalId);
    if (!before) {
      changes.push({
        sourceKey,
        period,
        previousPeriod: previous,
        externalId: record.externalId,
        changeType: "ADDED",
        changedFields: [],
        before: null,
        after: comparableAttributes(record),
        geometry: record.geometry,
        bbox: record.bbox,
      });
      continue;
    }
    priorById.delete(record.externalId);
    if (before.checksum === record.checksum) continue;

    const beforeAttrs = comparableAttributes(before);
    const afterAttrs = comparableAttributes(record);
    const fields = changedFieldsBetween(beforeAttrs, afterAttrs);
    // A checksum can move because the geometry moved while every attribute
    // stayed the same; that is still a change worth reporting.
    changes.push({
      sourceKey,
      period,
      previousPeriod: previous,
      externalId: record.externalId,
      changeType: "MODIFIED",
      changedFields: fields.length > 0 ? fields : ["geometry"],
      before: beforeAttrs,
      after: afterAttrs,
      geometry: record.geometry,
      bbox: record.bbox,
    });
  }

  for (const removed of priorById.values()) {
    changes.push({
      sourceKey,
      period,
      previousPeriod: previous,
      externalId: removed.externalId,
      changeType: "REMOVED",
      changedFields: [],
      before: comparableAttributes(removed),
      after: null,
      geometry: removed.geometry,
      bbox: removed.bbox,
    });
  }

  return changes.sort(
    (a, b) => a.changeType.localeCompare(b.changeType) || a.externalId.localeCompare(b.externalId),
  );
}

/** Keeps only the changes that actually touch the area of interest. */
export function changesTouching(aoi: GeoGeometry, changes: CorpusChange[]): CorpusChange[] {
  const box = bboxOf(aoi) as BBox;
  return changes.filter((change) => {
    if (change.bbox && !bboxIntersects(change.bbox, box)) return false;
    if (!change.geometry) return true;
    return overlap(aoi, change.geometry).areaHectares > 0;
  });
}

function describe(changes: CorpusChange[], period: string): string {
  if (changes.length === 0) {
    return `No change in ${periodLabel(period)} across the monitored official layers for this area.`;
  }
  const byType = { ADDED: 0, REMOVED: 0, MODIFIED: 0 };
  const sources = new Set<string>();
  for (const change of changes) {
    byType[change.changeType] += 1;
    sources.add(SOURCE_DEFINITIONS[change.sourceKey]?.name ?? change.sourceKey);
  }
  const parts: string[] = [];
  if (byType.ADDED) parts.push(`${byType.ADDED} new record(s)`);
  if (byType.MODIFIED) parts.push(`${byType.MODIFIED} modified`);
  if (byType.REMOVED) parts.push(`${byType.REMOVED} withdrawn`);
  return `${periodLabel(period)}: ${parts.join(", ")} affecting this area, across ${[...sources].join(" and ")}.`;
}

/**
 * Builds the monthly report for one watched area.
 *
 * A quiet month is still a report. "Nothing changed" is a finding an operator
 * can act on, and suppressing it would make silence ambiguous between "no
 * change" and "we did not look".
 */
export async function buildWatchReport(
  watch: WatchSubscription,
  period = periodOf(),
): Promise<WatchReport> {
  const previous = previousPeriod(period);
  const collected: CorpusChange[] = [];

  for (const sourceKey of HARVESTABLE_SOURCES) {
    const changes = await diffSnapshots(sourceKey, period, previous);
    collected.push(...changesTouching(watch.geometry, changes));
  }

  return {
    id: randomUUID(),
    watchId: watch.id,
    projectId: watch.projectId,
    period,
    previousPeriod: previous,
    generatedAt: new Date().toISOString(),
    changes: collected,
    quiet: collected.length === 0,
    summary: describe(collected, period),
  };
}
