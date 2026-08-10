/**
 * Source contract (Plan Maestro §6.1).
 *
 * Every external data source in LegalMine Sentinel is accessed through an
 * adapter that returns this shape. The status is never inferred and never
 * silently replaced: if a source cannot answer, the adapter says so and the
 * Data Confidence score absorbs the loss. No adapter is allowed to invent a
 * fallback record.
 */

export type SourceStatus =
  /** The source answered and the payload is current. */
  | "OK"
  /** The source answered but the snapshot is older than its freshness budget. */
  | "STALE"
  /** The source was queried and did not answer (network, 5xx, timeout). */
  | "UNAVAILABLE"
  /** No automated interface is configured; a human must verify this fact. */
  | "MANUAL_VERIFICATION_REQUIRED"
  /** The deployment has not been given an endpoint for this source. */
  | "NOT_CONFIGURED";

/** Where a record came from, which decides how it may be phrased in the UI. */
export type SourceTier =
  /** Published by the authoritative government body. */
  | "official"
  /** Public/community data used for context only. */
  | "reference"
  /** Uploaded or typed in by the user. */
  | "user_provided"
  /** Fixture data. Only ever visible with a DEMO watermark. */
  | "demo";

export interface SourceResult<T> {
  sourceKey: string;
  sourceName: string;
  official: boolean;
  tier: SourceTier;
  status: SourceStatus;
  /** ISO timestamp of when this adapter ran. */
  fetchedAt: string;
  /** ISO timestamp of the data's own validity/publication date, when the source exposes one. */
  validAt?: string;
  /** Human-resolvable URL for an auditor to reproduce the query. */
  sourceUrl?: string;
  records: T[];
  /** Limitations declared by the source, or by us about the source. */
  warnings: string[];
  /** Checksum of the raw payload, so a snapshot can be proven unchanged. */
  rawChecksum?: string;
  durationMs?: number;
}

export interface SourceHealth {
  sourceKey: string;
  sourceName: string;
  official: boolean;
  status: SourceStatus;
  lastSuccessfulFetch: string | null;
  message: string;
  docsUrl?: string;
  /** True when the deployment has an endpoint configured for this source. */
  configured: boolean;
}

/** Statuses that still allow a factor to make a positive/negative claim. */
export const CONCLUSIVE_STATUSES: SourceStatus[] = ["OK", "STALE"];

export function isConclusive(status: SourceStatus): boolean {
  return CONCLUSIVE_STATUSES.includes(status);
}
