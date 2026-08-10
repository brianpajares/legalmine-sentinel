import { createHash } from "node:crypto";

import type { GeoGeometry, PolygonGeometry, Position } from "@/types/geo";
import { SOURCE_TIMEOUT_MS } from "./config";

/**
 * Thin client for the ArcGIS REST `query` operation, which both GEOCATMIN and
 * the SERNANP geoservices expose. The contract is stable across Esri servers:
 * we post a polygon and get intersecting features back.
 *
 * Two response encodings are handled — `f=geojson` when the server supports it
 * (ArcGIS Server 10.4+), and Esri JSON (`f=json`) as a fallback, converted here.
 */

export interface ArcGisFeature {
  attributes: Record<string, unknown>;
  geometry: GeoGeometry | null;
}

export interface ArcGisQueryResult {
  features: ArcGisFeature[];
  /** Query URL an auditor can paste into a browser to reproduce the result. */
  requestUrl: string;
  checksum: string;
  durationMs: number;
}

export class ArcGisError extends Error {
  readonly requestUrl: string;
  constructor(message: string, requestUrl: string) {
    super(message);
    this.name = "ArcGisError";
    this.requestUrl = requestUrl;
  }
}

function toEsriRings(geometry: GeoGeometry): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  return geometry.coordinates.flat();
}

/** Signed area of a ring; positive means clockwise in Esri's convention. */
function ringIsClockwise(ring: Position[]): boolean {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum > 0;
}

/**
 * Esri encodes every ring of every polygon in a flat list, distinguishing
 * outer rings (clockwise) from holes (counter-clockwise). Rebuild GeoJSON by
 * starting a new polygon at each clockwise ring.
 */
export function esriRingsToGeoJson(rings: Position[][]): GeoGeometry | null {
  if (!Array.isArray(rings) || rings.length === 0) return null;
  const polygons: Position[][][] = [];
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) continue;
    if (ringIsClockwise(ring) || polygons.length === 0) polygons.push([ring]);
    else polygons[polygons.length - 1].push(ring);
  }
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0] } as PolygonGeometry;
  return { type: "MultiPolygon", coordinates: polygons };
}

function normalizeGeoJsonGeometry(geometry: unknown): GeoGeometry | null {
  if (!geometry || typeof geometry !== "object") return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type === "Polygon" || g.type === "MultiPolygon") {
    return g as GeoGeometry;
  }
  return null;
}

function buildQueryParams(geometry: GeoGeometry, outFields: string, maxRecords: number) {
  const esriGeometry = {
    rings: toEsriRings(geometry),
    spatialReference: { wkid: 4326 },
  };
  return {
    where: "1=1",
    geometry: JSON.stringify(esriGeometry),
    geometryType: "esriGeometryPolygon",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    outFields,
    returnGeometry: "true",
    resultRecordCount: String(maxRecords),
    f: "geojson",
  } satisfies Record<string, string>;
}

export interface ArcGisQueryOptions {
  layerUrl: string;
  geometry: GeoGeometry;
  outFields?: string;
  maxRecords?: number;
  timeoutMs?: number;
}

/** Posts a query and returns the parsed body, raising ArcGisError on any
 *  transport-, protocol- or service-level failure. */
async function postArcGis(
  endpoint: string,
  params: Record<string, string>,
  timeoutMs: number,
  requestUrl: string,
): Promise<{ body: Record<string, unknown>; text: string; durationMs: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(params).toString(),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timer);
    const reason = error instanceof Error && error.name === "AbortError"
      ? `timed out after ${timeoutMs} ms`
      : error instanceof Error
        ? error.message
        : "network error";
    throw new ArcGisError(`Could not reach the layer (${reason}).`, requestUrl);
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new ArcGisError(`The service responded with HTTP ${response.status}.`, requestUrl);
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ArcGisError("The service did not return JSON.", requestUrl);
  }

  const body = payload as Record<string, unknown>;
  // ArcGIS reports failures with HTTP 200 and an `error` member.
  if (body.error) {
    const err = body.error as { message?: string; details?: string[] };
    throw new ArcGisError(
      `The service returned an error: ${err.message ?? "unknown"}${
        err.details?.length ? ` (${err.details.join("; ")})` : ""
      }`,
      requestUrl,
    );
  }

  return { body, text, durationMs: Date.now() - started };
}

/** Normalizes both response encodings into a single feature shape. */
export function parseArcGisFeatures(body: Record<string, unknown>): ArcGisFeature[] {
  const features: ArcGisFeature[] = [];
  if (!Array.isArray(body.features)) return features;

  for (const raw of body.features as Record<string, unknown>[]) {
    // GeoJSON encoding
    if (raw.type === "Feature" || raw.properties) {
      features.push({
        attributes: (raw.properties as Record<string, unknown>) ?? {},
        geometry: normalizeGeoJsonGeometry(raw.geometry),
      });
      continue;
    }
    // Esri JSON encoding
    const esriGeometry = raw.geometry as { rings?: Position[][] } | undefined;
    features.push({
      attributes: (raw.attributes as Record<string, unknown>) ?? {},
      geometry: esriGeometry?.rings ? esriRingsToGeoJson(esriGeometry.rings) : null,
    });
  }
  return features;
}

/** Runs an intersects query and throws ArcGisError when the layer cannot answer. */
export async function queryArcGisLayer(options: ArcGisQueryOptions): Promise<ArcGisQueryResult> {
  const { layerUrl, geometry, outFields = "*", maxRecords = 200 } = options;
  const timeoutMs = options.timeoutMs ?? SOURCE_TIMEOUT_MS;
  const endpoint = `${layerUrl.replace(/\/+$/, "")}/query`;
  const params = buildQueryParams(geometry, outFields, maxRecords);
  const requestUrl = `${endpoint}?${new URLSearchParams({ ...params, geometry: "<AOI polygon>" }).toString()}`;

  const { body, text, durationMs } = await postArcGis(endpoint, params, timeoutMs, requestUrl);

  return {
    features: parseArcGisFeatures(body),
    requestUrl,
    checksum: createHash("sha256").update(text).digest("hex").slice(0, 32),
    durationMs,
  };
}

export interface ArcGisPageOptions {
  layerUrl: string;
  /** Records to skip. ArcGIS paging is offset-based. */
  offset: number;
  pageSize: number;
  outFields?: string;
  /**
   * Sort key for the harvest. Offset paging is only stable under a deterministic
   * order, so a harvest without one can silently duplicate and drop records
   * between pages. Defaults to the Esri object id, which every layer exposes.
   */
  orderByFields?: string;
  timeoutMs?: number;
}

export interface ArcGisPageResult extends ArcGisQueryResult {
  /** True when the service has more rows beyond this page. */
  exceededTransferLimit: boolean;
}

/**
 * Reads one page of an entire layer, without a geometry filter.
 *
 * This is the harvest path that builds a monthly snapshot, as opposed to the
 * per-AOI intersects query above.
 */
export async function queryArcGisPage(options: ArcGisPageOptions): Promise<ArcGisPageResult> {
  const { layerUrl, offset, pageSize, outFields = "*", orderByFields = "OBJECTID" } = options;
  const timeoutMs = options.timeoutMs ?? SOURCE_TIMEOUT_MS;
  const endpoint = `${layerUrl.replace(/\/+$/, "")}/query`;
  const params = {
    where: "1=1",
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    orderByFields,
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
    f: "geojson",
  } satisfies Record<string, string>;
  const requestUrl = `${endpoint}?${new URLSearchParams(params).toString()}`;

  const { body, text, durationMs } = await postArcGis(endpoint, params, timeoutMs, requestUrl);

  return {
    features: parseArcGisFeatures(body),
    requestUrl,
    checksum: createHash("sha256").update(text).digest("hex").slice(0, 32),
    durationMs,
    exceededTransferLimit: body.exceededTransferLimit === true,
  };
}

/** Total row count for a layer, used to size a harvest before it starts. */
export async function countArcGisRecords(
  layerUrl: string,
  timeoutMs = SOURCE_TIMEOUT_MS,
): Promise<number | null> {
  const endpoint = `${layerUrl.replace(/\/+$/, "")}/query`;
  const params = { where: "1=1", returnCountOnly: "true", f: "json" };
  try {
    const { body } = await postArcGis(endpoint, params, timeoutMs, endpoint);
    return typeof body.count === "number" ? body.count : null;
  } catch {
    return null;
  }
}

/** Lightweight reachability probe used by /api/health/sources. */
export async function probeArcGisLayer(
  layerUrl: string,
  timeoutMs = SOURCE_TIMEOUT_MS,
): Promise<{ ok: boolean; message: string; layerName?: string }> {
  const endpoint = `${layerUrl.replace(/\/+$/, "")}?f=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return { ok: false, message: `HTTP ${response.status} from the layer metadata endpoint.` };
    const body = (await response.json()) as Record<string, unknown>;
    if (body.error) {
      const err = body.error as { message?: string };
      return { ok: false, message: err.message ?? "The layer returned an error." };
    }
    const layerName = typeof body.name === "string" ? body.name : undefined;
    return { ok: true, message: layerName ? `Layer "${layerName}" is reachable.` : "Layer is reachable.", layerName };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? `timed out after ${timeoutMs} ms`
      : error instanceof Error
        ? error.message
        : "network error";
    return { ok: false, message: `Could not reach the layer (${reason}).` };
  } finally {
    clearTimeout(timer);
  }
}
