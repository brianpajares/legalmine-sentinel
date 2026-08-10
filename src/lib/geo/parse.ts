import type {
  GeoGeometry,
  MultiPolygonGeometry,
  ParsedAoi,
  PolygonGeometry,
  Position,
} from "@/types/geo";

export class AoiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AoiParseError";
  }
}

const MAX_VERTICES = 20_000;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Rejects anything that is not a plausible WGS84 lon/lat pair. */
function assertLonLat(pos: unknown, context: string): Position {
  if (!Array.isArray(pos) || pos.length < 2) {
    throw new AoiParseError(`${context}: expected a [longitude, latitude] pair.`);
  }
  const [lon, lat] = pos as [unknown, unknown];
  if (!isFiniteNumber(lon) || !isFiniteNumber(lat)) {
    throw new AoiParseError(`${context}: coordinates must be finite numbers.`);
  }
  if (lon < -180 || lon > 180) {
    throw new AoiParseError(
      `${context}: longitude ${lon} is out of range (-180..180). Check that the file is not in a projected CRS such as UTM.`,
    );
  }
  if (lat < -90 || lat > 90) {
    throw new AoiParseError(
      `${context}: latitude ${lat} is out of range (-90..90). Check the coordinate order — GeoJSON and KML both use [longitude, latitude].`,
    );
  }
  return [lon, lat];
}

/** Closes an open ring and validates it has enough distinct vertices. */
function normalizeRing(ring: unknown, context: string, warnings: string[]): Position[] {
  if (!Array.isArray(ring)) throw new AoiParseError(`${context}: ring is not an array.`);
  const positions = ring.map((p, i) => assertLonLat(p, `${context}[${i}]`));
  if (positions.length < 3) {
    throw new AoiParseError(`${context}: a ring needs at least 3 distinct vertices.`);
  }
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    positions.push([first[0], first[1]]);
    warnings.push(`${context}: ring was not closed; the first vertex was repeated to close it.`);
  }
  if (positions.length < 4) {
    throw new AoiParseError(`${context}: a closed ring needs at least 4 positions.`);
  }
  return positions;
}

function normalizePolygon(coords: unknown, context: string, warnings: string[]): PolygonGeometry {
  if (!Array.isArray(coords) || coords.length === 0) {
    throw new AoiParseError(`${context}: polygon has no rings.`);
  }
  const rings = coords.map((ring, i) => normalizeRing(ring, `${context}.ring[${i}]`, warnings));
  return { type: "Polygon", coordinates: rings };
}

function countVertices(geometry: GeoGeometry): number {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  }
  return geometry.coordinates.reduce(
    (sum, poly) => sum + poly.reduce((s, ring) => s + ring.length, 0),
    0,
  );
}

function assertSize(geometry: GeoGeometry) {
  const vertices = countVertices(geometry);
  if (vertices > MAX_VERTICES) {
    throw new AoiParseError(
      `Geometry has ${vertices} vertices, above the ${MAX_VERTICES} limit. Simplify the polygon before uploading.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* GeoJSON                                                                     */
/* -------------------------------------------------------------------------- */

type UnknownRecord = Record<string, unknown>;

function extractGeoJsonGeometry(
  node: unknown,
  warnings: string[],
): { geometry: GeoGeometry; name?: string } {
  if (!node || typeof node !== "object") {
    throw new AoiParseError("The GeoJSON payload is empty or not an object.");
  }
  const obj = node as UnknownRecord;
  const type = obj.type;

  if (type === "FeatureCollection") {
    const features = Array.isArray(obj.features) ? obj.features : [];
    const polygonal = features.filter((f) => {
      const g = (f as UnknownRecord)?.geometry as UnknownRecord | undefined;
      return g?.type === "Polygon" || g?.type === "MultiPolygon";
    });
    if (polygonal.length === 0) {
      throw new AoiParseError(
        "The FeatureCollection contains no Polygon or MultiPolygon feature. Point and line geometries cannot define an area of interest.",
      );
    }
    if (polygonal.length > 1) {
      warnings.push(
        `The file contained ${polygonal.length} polygon features; they were merged into a single MultiPolygon area of interest.`,
      );
      const parts: Position[][][] = [];
      let name: string | undefined;
      for (const feature of polygonal) {
        const inner = extractGeoJsonGeometry(feature, warnings);
        name = name ?? inner.name;
        if (inner.geometry.type === "Polygon") parts.push(inner.geometry.coordinates);
        else parts.push(...inner.geometry.coordinates);
      }
      return { geometry: { type: "MultiPolygon", coordinates: parts }, name };
    }
    return extractGeoJsonGeometry(polygonal[0], warnings);
  }

  if (type === "Feature") {
    const props = (obj.properties ?? {}) as UnknownRecord;
    const name =
      typeof props.name === "string"
        ? props.name
        : typeof props.NOMBRE === "string"
          ? props.NOMBRE
          : undefined;
    const inner = extractGeoJsonGeometry(obj.geometry, warnings);
    return { geometry: inner.geometry, name: name ?? inner.name };
  }

  if (type === "Polygon") {
    return { geometry: normalizePolygon(obj.coordinates, "Polygon", warnings) };
  }

  if (type === "MultiPolygon") {
    const raw = obj.coordinates;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new AoiParseError("MultiPolygon has no polygons.");
    }
    const polygons = raw.map(
      (poly, i) => normalizePolygon(poly, `MultiPolygon[${i}]`, warnings).coordinates,
    );
    return { geometry: { type: "MultiPolygon", coordinates: polygons } };
  }

  if (type === "GeometryCollection") {
    const geometries = Array.isArray(obj.geometries) ? obj.geometries : [];
    const first = geometries.find((g) => {
      const t = (g as UnknownRecord)?.type;
      return t === "Polygon" || t === "MultiPolygon";
    });
    if (!first) {
      throw new AoiParseError("The GeometryCollection contains no polygonal geometry.");
    }
    warnings.push("A GeometryCollection was supplied; only its first polygonal geometry was used.");
    return extractGeoJsonGeometry(first, warnings);
  }

  throw new AoiParseError(
    `Unsupported GeoJSON type "${String(type)}". Provide a Polygon, MultiPolygon, Feature or FeatureCollection.`,
  );
}

/* -------------------------------------------------------------------------- */
/* KML                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * KML coordinate tuples are "lon,lat[,alt]" separated by whitespace.
 * Altitude, when present, is discarded — the assessment is strictly 2D.
 */
function parseKmlCoordinateString(raw: string, context: string): Position[] {
  const tuples = raw.trim().split(/\s+/).filter(Boolean);
  const positions: Position[] = [];
  for (const tuple of tuples) {
    const parts = tuple.split(",");
    if (parts.length < 2) continue;
    const lon = Number.parseFloat(parts[0]);
    const lat = Number.parseFloat(parts[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    positions.push(assertLonLat([lon, lat], context));
  }
  return positions;
}

function stripComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

function matchAll(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(pattern)).map((m) => m[1]);
}

/**
 * Dependency-free KML reader for the one shape we care about: polygons.
 *
 * It walks <Polygon> blocks (including those nested in <MultiGeometry>) and
 * keeps outer boundaries plus holes. Anything else in the document — points,
 * paths, styles, network links — is ignored on purpose.
 */
function extractKmlGeometry(
  text: string,
  warnings: string[],
): { geometry: GeoGeometry; name?: string } {
  const xml = stripComments(text);
  const polygonBlocks = matchAll(xml, /<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/gi);

  if (polygonBlocks.length === 0) {
    const hasLineString = /<LineString\b/i.test(xml);
    const hasPoint = /<Point\b/i.test(xml);
    if (hasLineString || hasPoint) {
      throw new AoiParseError(
        "The KML file contains only points or paths. An area of interest requires at least one <Polygon>.",
      );
    }
    throw new AoiParseError("No <Polygon> element was found in the KML file.");
  }

  const polygons: Position[][][] = [];
  for (const [index, block] of polygonBlocks.entries()) {
    const outerRaw = matchAll(
      block,
      /<outerBoundaryIs\b[^>]*>[\s\S]*?<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>[\s\S]*?<\/outerBoundaryIs>/gi,
    );
    // Some exporters omit <outerBoundaryIs> and put a bare LinearRing inside.
    const fallbackRaw =
      outerRaw.length === 0
        ? matchAll(block, /<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/gi).slice(0, 1)
        : [];
    const outerSource = outerRaw.length > 0 ? outerRaw[0] : fallbackRaw[0];
    if (!outerSource) continue;

    const outer = parseKmlCoordinateString(outerSource, `KML Polygon[${index}] outer boundary`);
    if (outer.length < 3) continue;
    const rings: Position[][] = [
      normalizeRing(outer, `KML Polygon[${index}] outer boundary`, warnings),
    ];

    const innerRaw = matchAll(
      block,
      /<innerBoundaryIs\b[^>]*>[\s\S]*?<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>[\s\S]*?<\/innerBoundaryIs>/gi,
    );
    for (const [holeIndex, hole] of innerRaw.entries()) {
      const positions = parseKmlCoordinateString(
        hole,
        `KML Polygon[${index}] hole[${holeIndex}]`,
      );
      if (positions.length >= 3) {
        rings.push(normalizeRing(positions, `KML Polygon[${index}] hole[${holeIndex}]`, warnings));
      }
    }
    polygons.push(rings);
  }

  if (polygons.length === 0) {
    throw new AoiParseError("The KML polygons did not contain usable coordinates.");
  }

  const nameMatch = xml.match(/<Placemark\b[^>]*>[\s\S]*?<name\b[^>]*>([\s\S]*?)<\/name>/i);
  const docNameMatch = xml.match(/<name\b[^>]*>([\s\S]*?)<\/name>/i);
  const rawName = (nameMatch?.[1] ?? docNameMatch?.[1] ?? "").trim();
  const name = rawName
    ? rawName.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() || undefined
    : undefined;

  if (polygons.length === 1) {
    return { geometry: { type: "Polygon", coordinates: polygons[0] }, name };
  }
  warnings.push(
    `The KML file contained ${polygons.length} polygons; they were merged into a single MultiPolygon area of interest.`,
  );
  return { geometry: { type: "MultiPolygon", coordinates: polygons }, name };
}

/* -------------------------------------------------------------------------- */
/* Public entry points                                                         */
/* -------------------------------------------------------------------------- */

/** Parses raw file text (GeoJSON or KML) into a validated AOI. */
export function parseAoiFromText(text: string, filename?: string): ParsedAoi {
  const warnings: string[] = [];
  const trimmed = text?.trim() ?? "";
  if (!trimmed) throw new AoiParseError("The uploaded file is empty.");

  const looksLikeXml = trimmed.startsWith("<") || /<kml\b/i.test(trimmed);
  const extension = filename?.toLowerCase().split(".").pop();

  let result: { geometry: GeoGeometry; name?: string };
  let format: ParsedAoi["format"];

  if (looksLikeXml || extension === "kml") {
    result = extractKmlGeometry(trimmed, warnings);
    format = "kml";
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new AoiParseError(
        "The file is neither valid JSON nor valid KML. Supported formats are .geojson, .json and .kml.",
      );
    }
    result = extractGeoJsonGeometry(parsed, warnings);
    format = "geojson";
  }

  assertSize(result.geometry);
  return { geometry: result.geometry, name: result.name, format, warnings };
}

/**
 * Builds an AOI from a centre point and a radius, for users who only have
 * coordinates. The square is generated deterministically so the same input
 * always produces the same geometry hash.
 */
export function parseAoiFromCoordinates(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): ParsedAoi {
  assertLonLat([longitude, latitude], "Coordinates");
  if (!isFiniteNumber(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50_000) {
    throw new AoiParseError("Radius must be a positive number of metres, up to 50,000.");
  }
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180) || 1);
  const round = (n: number) => Number(n.toFixed(8));
  const ring: Position[] = [
    [round(longitude - lonDelta), round(latitude - latDelta)],
    [round(longitude + lonDelta), round(latitude - latDelta)],
    [round(longitude + lonDelta), round(latitude + latDelta)],
    [round(longitude - lonDelta), round(latitude + latDelta)],
    [round(longitude - lonDelta), round(latitude - latDelta)],
  ];
  return {
    geometry: { type: "Polygon", coordinates: [ring] },
    format: "coordinates",
    warnings: [
      "The area of interest is a bounding box generated from a centre point and radius, not a surveyed boundary.",
    ],
  };
}

export type { PolygonGeometry, MultiPolygonGeometry };
