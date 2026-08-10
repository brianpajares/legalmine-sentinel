import type { SourceResult } from "@/types/sources";
import type { GeoGeometry } from "@/types/geo";
import { ArcGisError, queryArcGisLayer } from "./arcgis";
import { reinfoConfig, SOURCE_DEFINITIONS, SOURCE_TIMEOUT_MS } from "./config";
import { pickDate, pickNumber, pickString } from "./fields";

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
  representative: string | null;
  ruc: string | null;
  rightCode: string | null;
  rightName: string | null;
  codReinfo: string | null;
  activityType: string | null;
  coordinateStatus: string | null;
  updatedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  raw: Record<string, unknown>;
}

function recordFromAttributes(raw: Record<string, unknown>, query = "AOI spatial query"): ReinfoRecord {
  return {
    query,
    found: true,
    status: pickString(raw, ["ESTADO", "estado"]),
    declarant: pickString(raw, ["NOMBRE_MIN", "declarante", "NOMBRE"]),
    representative: pickString(raw, ["NOMBRE_REP"]),
    ruc: pickString(raw, ["M_RUC", "RUC"]),
    rightCode: pickString(raw, ["ID_UNIDAD", "CODIGOU", "CODIGO"]),
    rightName: pickString(raw, ["NOMBRE_DER", "CONCESION", "DERECHO"]),
    codReinfo: pickString(raw, ["COD_REINFO"]),
    activityType: pickString(raw, ["TIPO_ACT"]),
    coordinateStatus: pickString(raw, ["FLG_COOROK"]),
    updatedAt: pickDate(raw, ["FECHA_ACTUALIZACION"]),
    latitude: pickNumber(raw, ["LATITUD_G84"]),
    longitude: pickNumber(raw, ["LONGITUD_G84"]),
    raw,
  };
}

export async function fetchReinfoStatus(
  query?: string,
  aoi?: GeoGeometry,
): Promise<SourceResult<ReinfoRecord>> {
  const fetchedAt = new Date().toISOString();
  const base = {
    sourceKey: DEFINITION.key,
    sourceName: DEFINITION.name,
    official: true,
    tier: "official" as const,
    fetchedAt,
    sourceUrl: DEFINITION.portalUrl,
  };

  const layerUrl = reinfoConfig.layerUrl;
  if (aoi && layerUrl) {
    try {
      const result = await queryArcGisLayer({ layerUrl, geometry: aoi, maxRecords: 200 });
      return {
        ...base,
        status: "OK",
        sourceUrl: result.requestUrl,
        records: result.features.map((feature) => recordFromAttributes(feature.attributes)),
        rawChecksum: result.checksum,
        durationMs: result.durationMs,
        warnings: [
          "REINFO spatial screening uses the official MINEM layer published through GEOCATMIN. It identifies declared REINFO coordinates intersecting the AOI; final registration status should still be checked in the MINEM REINFO portal before legal reliance.",
          "REINFO information is public and dynamic; a monthly snapshot should be retained in Drive for audit reproducibility.",
        ],
      };
    } catch (error) {
      const message = error instanceof ArcGisError || error instanceof Error
        ? error.message
        : "network error";
      return {
        ...base,
        status: "UNAVAILABLE",
        records: [],
        warnings: [
          `The official REINFO spatial layer could not be queried (${message}). Registration status remains unverified and data confidence is reduced.`,
        ],
      };
    }
  }

  const apiUrl = reinfoConfig.apiUrl;

  if (!apiUrl) {
    return {
      ...base,
      status: "MANUAL_VERIFICATION_REQUIRED",
      records: [],
      warnings: [
        "No AOI or automated REINFO lookup was executed for this assessment. No conclusion about registration status is generated, and the dossier lists the check as pending.",
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
        ...recordFromAttributes(row, query),
        status: typeof row.estado === "string" ? row.estado : recordFromAttributes(row, query).status,
        declarant:
          typeof row.declarante === "string" ? row.declarante : recordFromAttributes(row, query).declarant,
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
