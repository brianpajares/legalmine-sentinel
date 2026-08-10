/**
 * Minimal GeoJSON subset used across the product.
 * All geometries are stored in WGS84 / EPSG:4326 (Plan Maestro §5.4).
 */

export type Position = [number, number];

export interface PolygonGeometry {
  type: "Polygon";
  /** [outerRing, ...holes], each ring is a closed list of [lon, lat]. */
  coordinates: Position[][];
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: Position[][][];
}

export type GeoGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface GeoFeature<P = Record<string, unknown>> {
  type: "Feature";
  geometry: GeoGeometry;
  properties: P;
}

/** Result of validating and normalizing a user-supplied area of interest. */
export interface ParsedAoi {
  geometry: PolygonGeometry | MultiPolygonGeometry;
  /** Name found inside the file, if any. */
  name?: string;
  /** Original format detected. */
  format: "geojson" | "kml" | "kmz" | "coordinates";
  /** Non-fatal notes (holes dropped, extra features ignored, ring auto-closed...). */
  warnings: string[];
}

export interface GeometrySummary {
  geometryHash: string;
  areaHectares: number;
  centroid: Position;
  bbox: [number, number, number, number];
  vertexCount: number;
  format: ParsedAoi["format"];
}
