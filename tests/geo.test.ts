import { describe, expect, it } from "vitest";

import { AoiParseError, parseAoiFromCoordinates, parseAoiFromKmz, parseAoiFromText } from "@/lib/geo/parse";
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

function storedKmz(filename: string, content: string): Buffer {
  const name = Buffer.from(filename, "utf8");
  const data = Buffer.from(content, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 10);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);

  const centralOffset = local.length + name.length + data.length;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 12);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);

  const centralSize = central.length + name.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, name, data, central, name, end]);
}

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

  it("parses a KMZ upload by extracting its embedded KML", () => {
    const parsed = parseAoiFromKmz(storedKmz("doc.kml", VALID_KML));
    expect(parsed.format).toBe("kmz");
    expect(parsed.name).toBe("Test KML block");
    expect(parsed.warnings.join(" ")).toMatch(/KMZ archive read successfully/i);
    expect(areaHectares(parsed.geometry)).toBeGreaterThan(0);
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
