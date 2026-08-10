import { createHash } from "node:crypto";
import area from "@turf/area";
import bboxOf from "@turf/bbox";
import centroidOf from "@turf/centroid";
import intersect from "@turf/intersect";
import distance from "@turf/distance";
import { feature, featureCollection, point } from "@turf/helpers";
import type {
  Feature as GeoJsonFeature,
  MultiPolygon as GeoJsonMultiPolygon,
  Polygon as GeoJsonPolygon,
} from "geojson";

import type { GeoGeometry, GeometrySummary, ParsedAoi, Position } from "@/types/geo";

type PolygonalFeature = GeoJsonFeature<GeoJsonPolygon | GeoJsonMultiPolygon>;

function toFeature(geometry: GeoGeometry): PolygonalFeature {
  return feature(geometry as GeoJsonPolygon | GeoJsonMultiPolygon) as PolygonalFeature;
}

/** Square metres. Turf computes on a spheroid, so no manual reprojection is needed. */
export function areaSquareMeters(geometry: GeoGeometry): number {
  return area(toFeature(geometry));
}

export function areaHectares(geometry: GeoGeometry): number {
  return round(areaSquareMeters(geometry) / 10_000, 4);
}

export function centroid(geometry: GeoGeometry): Position {
  const c = centroidOf(toFeature(geometry));
  const [lon, lat] = c.geometry.coordinates;
  return [round(lon, 6), round(lat, 6)];
}

export function bbox(geometry: GeoGeometry): [number, number, number, number] {
  const b = bboxOf(toFeature(geometry));
  return [round(b[0], 6), round(b[1], 6), round(b[2], 6), round(b[3], 6)];
}

/**
 * Geometry of the shared area, or null when the two shapes do not overlap.
 * Turf returns null rather than throwing for disjoint inputs.
 */
export function intersectionGeometry(a: GeoGeometry, b: GeoGeometry): GeoGeometry | null {
  try {
    const result = intersect(featureCollection([toFeature(a), toFeature(b)]));
    if (!result?.geometry) return null;
    const { type } = result.geometry;
    if (type !== "Polygon" && type !== "MultiPolygon") return null;
    return result.geometry as GeoGeometry;
  } catch {
    // Malformed or self-intersecting source geometry: report no overlap rather
    // than guessing. The caller degrades confidence instead of inventing a number.
    return null;
  }
}

export interface OverlapResult {
  geometry: GeoGeometry | null;
  areaHectares: number;
  /** Share of the AOI covered by the other geometry, 0-100. */
  percentOfAoi: number;
}

/** Absolute and relative overlap, both stored so a score can be explained (§5.4). */
export function overlap(aoi: GeoGeometry, other: GeoGeometry): OverlapResult {
  const geometry = intersectionGeometry(aoi, other);
  if (!geometry) return { geometry: null, areaHectares: 0, percentOfAoi: 0 };
  const overlapM2 = areaSquareMeters(geometry);
  const aoiM2 = areaSquareMeters(aoi);
  return {
    geometry,
    areaHectares: round(overlapM2 / 10_000, 4),
    percentOfAoi: aoiM2 > 0 ? round((overlapM2 / aoiM2) * 100, 2) : 0,
  };
}

/** Great-circle distance in kilometres between two lon/lat positions. */
export function distanceKm(a: Position, b: Position): number {
  return round(distance(point(a), point(b), { units: "kilometers" }), 3);
}

/**
 * Stable identity for a geometry.
 *
 * Coordinates are rounded to ~1 cm before hashing so that floating point noise
 * from different parsers does not produce a different hash for the same shape.
 * Two identical AOIs must always yield the same assessment (§18.1 determinism).
 */
export function geometryHash(geometry: GeoGeometry): string {
  const canonical = canonicalize(geometry);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 32);
}

function canonicalize(geometry: GeoGeometry): unknown {
  const fix = (pos: Position): Position => [round(pos[0], 7), round(pos[1], 7)];
  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: geometry.coordinates.map((r) => r.map(fix)) };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((p) => p.map((r) => r.map(fix))),
  };
}

export function summarize(parsed: ParsedAoi): GeometrySummary {
  const { geometry } = parsed;
  const vertexCount =
    geometry.type === "Polygon"
      ? geometry.coordinates.reduce((s, r) => s + r.length, 0)
      : geometry.coordinates.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);
  return {
    geometryHash: geometryHash(geometry),
    areaHectares: areaHectares(geometry),
    centroid: centroid(geometry),
    bbox: bbox(geometry),
    vertexCount,
    format: parsed.format,
  };
}

/** ArcGIS envelope string for a bounding-box query: xmin,ymin,xmax,ymax. */
export function bboxToEnvelope(box: [number, number, number, number]): string {
  return box.join(",");
}

export function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
