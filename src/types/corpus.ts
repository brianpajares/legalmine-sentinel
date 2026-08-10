import type { GeoGeometry } from "./geo";

/**
 * The monthly territorial corpus.
 *
 * Assessments used to query every official layer live, at request time. That
 * made them slow, fragile when a source was down, and — worst of all — not
 * reproducible: once INGEMMET edits a record, a dossier issued last March can
 * no longer be re-derived, so it stops being defensible evidence.
 *
 * The corpus fixes that by harvesting each source into an immutable, dated
 * snapshot. An assessment names the exact snapshot it was computed against, so
 * the same question asked a year later returns the same answer, and the change
 * between two months becomes a product in its own right.
 */

export type BBox = [number, number, number, number];

export type SnapshotStatus =
  /** Harvest in progress; not yet usable for assessments. */
  | "BUILDING"
  /** The snapshot assessments are currently computed against. */
  | "ACTIVE"
  /** Kept for reproducibility of the dossiers that cite it. */
  | "SUPERSEDED"
  /** Harvest did not complete. Never silently replaces an ACTIVE snapshot. */
  | "FAILED";

export interface CorpusSnapshot {
  id: string;
  sourceKey: string;
  /** Calendar period this snapshot represents, `YYYY-MM`. */
  period: string;
  status: SnapshotStatus;
  /** Layer the harvest ran against, recorded so an auditor can reproduce it. */
  layerUrl: string | null;
  startedAt: string;
  completedAt: string | null;
  recordCount: number;
  /** sha256 over the sorted per-record checksums. Two snapshots with the same
   *  checksum are the same data, which is how "nothing changed" is proven. */
  checksum: string | null;
  coverage: BBox | null;
  /** Resume point for a harvest that outlived its serverless invocation. */
  cursor: number;
  warnings: string[];
}

export interface CorpusRecord {
  snapshotId: string;
  sourceKey: string;
  /** The source's own stable identifier (cadastral code, ANP name, ...). */
  externalId: string;
  geometry: GeoGeometry | null;
  /** Cheap prefilter so a spatial query does not deserialize every polygon. */
  bbox: BBox | null;
  /** Normalized at harvest time using the deployment's field mapping. */
  attributes: Record<string, unknown>;
  checksum: string;
}

export type ChangeType = "ADDED" | "REMOVED" | "MODIFIED";

/** One difference between consecutive snapshots of the same source. */
export interface CorpusChange {
  sourceKey: string;
  period: string;
  previousPeriod: string;
  externalId: string;
  changeType: ChangeType;
  /** Attribute names that differ. Empty for ADDED/REMOVED. */
  changedFields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  geometry: GeoGeometry | null;
  bbox: BBox | null;
}

/**
 * What an assessment was actually computed against.
 *
 * This is printed in the dossier. Without it "deterministic" would only mean
 * "stable within one session"; with it, the result is reproducible for as long
 * as the snapshot is retained.
 */
export interface CorpusBasis {
  sourceKey: string;
  period: string;
  snapshotId: string;
  checksum: string | null;
  ingestedAt: string;
  recordCount: number;
}

/** How an assessment sourced its data. Always stated on the report. */
export type EvidenceBasisMode =
  /** Read from a dated snapshot: fast, reproducible, as old as the period. */
  | "corpus"
  /** Queried live: current to the minute, slower, degrades when a source is down. */
  | "live";

export interface WatchSubscription {
  id: string;
  projectId: string;
  projectName: string;
  orgId: string;
  geometry: GeoGeometry;
  bbox: BBox;
  /** Only monthly today; the field exists so weekly does not need a migration. */
  cadence: "monthly";
  active: boolean;
  createdAt: string;
  /** Last period a report was produced for. */
  lastReportedPeriod: string | null;
  notifyEmail: string | null;
}

/** A monthly delta report for one watched area of interest. */
export interface WatchReport {
  id: string;
  watchId: string;
  projectId: string;
  period: string;
  previousPeriod: string;
  generatedAt: string;
  changes: CorpusChange[];
  /** True when nothing in the corpus touching this AOI changed. */
  quiet: boolean;
  summary: string;
}
