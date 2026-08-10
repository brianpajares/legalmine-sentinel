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

/** Runs an intersects query and throws ArcGisError when the layer cannot answer. */
export async function queryArcGisLayer(options: ArcGisQueryOptions): Promise<ArcGisQueryResult> {
  const { layerUrl, geometry, outFields = "*", maxRecords = 200 } = options;
  const timeoutMs = options.timeoutMs ?? SOURCE_TIMEOUT_MS;
  const endpoint = `${layerUrl.replace(/\/+$/, "")}/query`;
  const params = buildQueryParams(geometry, outFields, maxRecords);
  const requestUrl = `${endpoint}?${new URLSearchParams({ ...params, geometry: "<AOI polygon>" }).toString()}`;

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

  const features: ArcGisFeature[] = [];

  if (Array.isArray(body.features)) {
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
  }

  return {
    features,
    requestUrl,
    checksum: createHash("sha256").update(text).digest("hex").slice(0, 32),
    durationMs: Date.now() - started,
  };
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
