import type { GeoGeometry, Position } from "@/types/geo";

/**
 * Inline vector sketch of the assessed geometry.
 *
 * Drawn from the stored coordinates with no tile server involved, so the
 * dossier renders identically offline, in print and years later — which is the
 * point of a reproducible report. It is a scale-free outline, not a basemap,
 * and the caption says so.
 */
export default function AoiSketch({
  aoi,
  overlays = [],
  width = 520,
  height = 320,
}: {
  aoi: GeoGeometry;
  overlays?: { geometry: GeoGeometry; color: string; label: string }[];
  width?: number;
  height?: number;
}) {
  const all = [aoi, ...overlays.map((o) => o.geometry)];
  const points = all.flatMap(collectPositions);
  if (points.length === 0) return null;

  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const padding = 16;
  const spanLon = maxLon - minLon || 1e-6;
  const spanLat = maxLat - minLat || 1e-6;
  const scale = Math.min((width - padding * 2) / spanLon, (height - padding * 2) / spanLat);
  const offsetX = (width - spanLon * scale) / 2;
  const offsetY = (height - spanLat * scale) / 2;

  const project = ([lon, lat]: Position): [number, number] => [
    offsetX + (lon - minLon) * scale,
    // SVG y grows downward while latitude grows upward.
    height - (offsetY + (lat - minLat) * scale),
  ];

  const toPath = (geometry: GeoGeometry): string =>
    ringsOf(geometry)
      .map((ring) => {
        const [first, ...rest] = ring.map(project);
        if (!first) return "";
        return `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ${rest
          .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
          .join(" ")} Z`;
      })
      .join(" ");

  return (
    <figure className="print-break">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Outline of the assessed area of interest and the intersecting source geometries"
        className="rounded-lg border border-white/10 bg-white/[0.03] print-surface"
      >
        {overlays.map((overlay, index) => (
          <path
            key={`${overlay.label}-${index}`}
            d={toPath(overlay.geometry)}
            fill={overlay.color}
            fillOpacity={0.25}
            stroke={overlay.color}
            strokeWidth={1.2}
          />
        ))}
        <path
          d={toPath(aoi)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      </svg>
      <figcaption className="mt-2 text-[10px] leading-relaxed text-gray-500 print-muted">
        Outline of the area of interest (dashed) and the source geometries that intersect it. Scale-free
        sketch generated from the stored coordinates; it is not a georeferenced map and carries no basemap.
        {overlays.length > 0 ? (
          <>
            {" "}
            Layers:{" "}
            {overlays.map((overlay, index) => (
              <span key={`${overlay.label}-legend-${index}`}>
                {index > 0 ? ", " : ""}
                <span style={{ color: overlay.color }}>■</span> {overlay.label}
              </span>
            ))}
            .
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}

function ringsOf(geometry: GeoGeometry): Position[][] {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

function collectPositions(geometry: GeoGeometry): Position[] {
  return ringsOf(geometry).flat();
}
