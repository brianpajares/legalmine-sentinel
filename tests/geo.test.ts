import { describe, expect, it } from "vitest";

import { AoiParseError, parseAoiFromCoordinates, parseAoiFromText } from "@/lib/geo/parse";
import { areaHectares, geometryHash, overlap, summarize } from "@/lib/geo/measure";
import { AOI, ANP_GEOMETRY } from "./fixtures";

const VALID_GEOJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Test block" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-69.86, -12.9],
            [-69.82, -12.9],
            [-69.82, -12.93],
            [-69.86, -12.93],
            [-69.86, -12.9],
          ],
        ],
      },
    },
  ],
});

const VALID_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Placemark><name>Test KML block</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
-69.86,-12.90,0 -69.82,-12.90,0 -69.82,-12.93,0 -69.86,-12.93,0 -69.86,-12.90,0
</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;

describe("area of interest parsing (Plan Maestro §18.1 upload tests)", () => {
  it("preserves the geometry of a valid GeoJSON upload", () => {
    const parsed = parseAoiFromText(VALID_GEOJSON, "block.geojson");
    expect(parsed.format).toBe("geojson");
    expect(parsed.name).toBe("Test block");
    expect(parsed.geometry.type).toBe("Polygon");
    expect(areaHectares(parsed.geometry)).toBeGreaterThan(0);
  });

  it("parses a KML polygon and drops the altitude component", () => {
    const parsed = parseAoiFromText(VALID_KML, "block.kml");
    expect(parsed.format).toBe("kml");
    expect(parsed.name).toBe("Test KML block");
    const ring = (parsed.geometry as { coordinates: number[][][] }).coordinates[0];
    expect(ring[0]).toHaveLength(2);
  });

  it("produces the same geometry from equivalent GeoJSON and KML inputs", () => {
    const fromJson = parseAoiFromText(VALID_GEOJSON, "block.geojson");
    const fromKml = parseAoiFromText(VALID_KML, "block.kml");
    expect(geometryHash(fromKml.geometry)).toBe(geometryHash(fromJson.geometry));
  });

  it("closes an open ring and says so", () => {
    const open = JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [-69.86, -12.9],
          [-69.82, -12.9],
          [-69.82, -12.93],
          [-69.86, -12.93],
        ],
      ],
    });
    const parsed = parseAoiFromText(open, "open.geojson");
    expect(parsed.warnings.join(" ")).toMatch(/not closed/i);
  });

  it("rejects projected coordinates instead of screening a wrong area", () => {
    const utm = JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [412345, 8571234],
          [412400, 8571234],
          [412400, 8571300],
          [412345, 8571300],
          [412345, 8571234],
        ],
      ],
    });
    expect(() => parseAoiFromText(utm, "utm.geojson")).toThrow(AoiParseError);
    expect(() => parseAoiFromText(utm, "utm.geojson")).toThrow(/UTM|out of range/i);
  });

  it("rejects a KML that contains only points or paths", () => {
    const pointsOnly = `<kml><Document><Placemark><Point><coordinates>-69.8,-12.9,0</coordinates></Point></Placemark></Document></kml>`;
    expect(() => parseAoiFromText(pointsOnly, "points.kml")).toThrow(/only points or paths/i);
  });

  it("rejects malformed input rather than creating a partial project", () => {
    expect(() => parseAoiFromText("{ not json", "broken.geojson")).toThrow(AoiParseError);
    expect(() => parseAoiFromText("", "empty.geojson")).toThrow(/empty/i);
    expect(() => parseAoiFromText(JSON.stringify({ type: "Point", coordinates: [0, 0] }))).toThrow(
      /Unsupported GeoJSON type/i,
    );
  });

  it("builds a deterministic box from a centre point and radius", () => {
    const a = parseAoiFromCoordinates(-12.915, -69.84, 1000);
    const b = parseAoiFromCoordinates(-12.915, -69.84, 1000);
    expect(geometryHash(a.geometry)).toBe(geometryHash(b.geometry));
    expect(a.warnings.join(" ")).toMatch(/not a surveyed boundary/i);
    expect(() => parseAoiFromCoordinates(-12.915, -69.84, 0)).toThrow(/positive number/i);
    expect(() => parseAoiFromCoordinates(999, -69.84, 100)).toThrow(/latitude/i);
  });
});

describe("measurement", () => {
  it("hashes identical geometries to the same value and different ones apart", () => {
    expect(geometryHash(AOI)).toBe(geometryHash(structuredClone(AOI)));
    expect(geometryHash(AOI)).not.toBe(geometryHash(ANP_GEOMETRY));
  });

  it("reports overlap as both an absolute area and a share of the AOI", () => {
    const result = overlap(AOI, ANP_GEOMETRY);
    expect(result.areaHectares).toBeGreaterThan(0);
    expect(result.percentOfAoi).toBeGreaterThan(0);
    expect(result.percentOfAoi).toBeLessThanOrEqual(100);
    expect(result.geometry).not.toBeNull();
  });

  it("returns zero overlap for disjoint geometries rather than throwing", () => {
    const far = {
      type: "Polygon" as const,
      coordinates: [
        [
          [-60, -10],
          [-59.9, -10],
          [-59.9, -10.1],
          [-60, -10.1],
          [-60, -10],
        ] as [number, number][],
      ],
    };
    const result = overlap(AOI, far);
    expect(result.areaHectares).toBe(0);
    expect(result.percentOfAoi).toBe(0);
    expect(result.geometry).toBeNull();
  });

  it("summarizes an AOI with area, centroid, bbox and vertex count", () => {
    const summary = summarize({ geometry: AOI, format: "geojson", warnings: [] });
    expect(summary.areaHectares).toBeGreaterThan(0);
    expect(summary.vertexCount).toBe(5);
    expect(summary.bbox).toHaveLength(4);
    expect(summary.geometryHash).toHaveLength(32);
  });
});
