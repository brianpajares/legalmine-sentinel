import type { SourceResult } from "@/types/sources";
import { reinfoConfig, SOURCE_DEFINITIONS, SOURCE_TIMEOUT_MS } from "./config";

const DEFINITION = SOURCE_DEFINITIONS.reinfo;

/**
 * REINFO registration status for a declarant.
 *
 * The registry is public and updated continuously, but no stable official API
 * was confirmed. Rather than scrape a portal that can change without notice,
 * the default adapter returns MANUAL_VERIFICATION_REQUIRED and hands the
 * operator a deep link. Absence of a record is never converted into an
 * accusation of illegality (§7.6, §16.2).
 */
export interface ReinfoRecord {
  query: string;
  found: boolean;
  status: string | null;
  declarant: string | null;
  raw: Record<string, unknown>;
}

export async function fetchReinfoStatus(query?: string): Promise<SourceResult<ReinfoRecord>> {
  const fetchedAt = new Date().toISOString();
  const base = {
    sourceKey: DEFINITION.key,
    sourceName: DEFINITION.name,
    official: true,
    tier: "official" as const,
    fetchedAt,
    sourceUrl: DEFINITION.portalUrl,
  };

  const apiUrl = reinfoConfig.apiUrl;

  if (!apiUrl) {
    return {
      ...base,
      status: "MANUAL_VERIFICATION_REQUIRED",
      records: [],
      warnings: [
        "No automated REINFO lookup was executed for this assessment. No conclusion about registration status is generated, and the dossier lists the check as pending.",
        "Verify manually in the MINEM REINFO portal and attach the result to the assessment.",
      ],
    };
  }

  if (!query) {
    return {
      ...base,
      status: "MANUAL_VERIFICATION_REQUIRED",
      records: [],
      warnings: [
        "A REINFO endpoint is configured but no declarant or right identifier was supplied to query it. Registration status remains unverified.",
      ],
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const url = `${apiUrl}${apiUrl.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as Record<string, unknown>;
    const rows = Array.isArray(payload.records) ? (payload.records as Record<string, unknown>[]) : [];
    return {
      ...base,
      status: "OK",
      sourceUrl: url,
      records: rows.map((row) => ({
        query,
        found: true,
        status: typeof row.estado === "string" ? row.estado : null,
        declarant: typeof row.declarante === "string" ? row.declarante : null,
        raw: row,
      })),
      warnings: rows.length
        ? []
        : ["The configured REINFO endpoint returned no matching record. This is not evidence of illegality; confirm the identifier used for the query."],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    return {
      ...base,
      status: "UNAVAILABLE",
      records: [],
      warnings: [
        `The configured REINFO endpoint could not be reached (${message}). Registration status remains unverified and data confidence is reduced.`,
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}
