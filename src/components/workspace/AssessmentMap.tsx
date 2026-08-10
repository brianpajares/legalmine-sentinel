"use client";

import { useEffect, useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";

import type { Evidence } from "@/types/evidence";
import type { GeoGeometry, Position } from "@/types/geo";
import { formatTimestamp, TIER_LABELS } from "@/lib/ui/format";

/**
 * Evidence map.
 *
 * Every layer drawn here comes from an assessment's evidence: the area of
 * interest the user supplied, plus the geometries returned by the sources.
 * There are no decorative or illustrative overlays — if a shape is on the map,
 * it has an evidence record and a source badge behind it.
 */

interface AssessmentMapProps {
  aoi: GeoGeometry;
  evidence: Evidence[];
  center: Position;
  onSelectEvidence?: (evidence: Evidence) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  ingemmet: "#3b82f6",
  sernanp: "#10b981",
  reinfo: "#f59e0b",
  copernicus: "#06b6d4",
};

function FitBounds({ aoi }: { aoi: GeoGeometry }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.geoJSON(aoi as unknown as Geometry);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [aoi, map]);
  return null;
}

export default function AssessmentMap({
  aoi,
  evidence,
  center,
  onSelectEvidence,
}: AssessmentMapProps) {
  const geometryEvidence = useMemo(
    () => evidence.filter((item): item is Evidence & { geometry: GeoGeometry } => Boolean(item.geometry)),
    [evidence],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 shadow-2xl">
      <MapContainer
        center={[center[1], center[0]]}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="Imagery &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <FitBounds aoi={aoi} />

        {geometryEvidence.map((item) => {
          const color = SOURCE_COLORS[item.sourceKey] ?? "#a855f7";
          return (
            <GeoJSON
              key={item.id}
              data={item.geometry as unknown as Feature}
              style={{
                color,
                weight: 1.5,
                fillColor: color,
                fillOpacity: item.tier === "demo" ? 0.15 : 0.28,
                dashArray: item.tier === "demo" ? "6 6" : undefined,
              }}
              eventHandlers={{ click: () => onSelectEvidence?.(item) }}
              onEachFeature={(_feature, layer) => {
                layer.bindPopup(
                  `<div style="font-size:11px;line-height:1.5;max-width:240px">
                     <strong>${escapeHtml(item.title)}</strong><br/>
                     <span style="opacity:.75">${escapeHtml(item.sourceName)}</span><br/>
                     <span style="opacity:.75">${TIER_LABELS[item.tier]} · queried ${escapeHtml(formatTimestamp(item.fetchedAt))}</span>
                   </div>`,
                );
              }}
            />
          );
        })}

        {/* The AOI is drawn last so its outline stays legible above the source layers. */}
        <GeoJSON
          data={aoi as unknown as Feature}
          style={{ color: "#ffffff", weight: 2.5, fillColor: "#ffffff", fillOpacity: 0.05 }}
        />
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/10 bg-[#070a13]/85 px-3 py-2 text-[10px] leading-relaxed text-gray-300 backdrop-blur">
        <p className="mb-1 font-bold uppercase tracking-wider text-gray-400">Layers</p>
        <p>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-white" /> Area of interest
        </p>
        {Object.entries(SOURCE_COLORS)
          .filter(([key]) => geometryEvidence.some((e) => e.sourceKey === key))
          .map(([key, color]) => (
            <p key={key}>
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {key}
            </p>
          ))}
        {geometryEvidence.length === 0 ? (
          <p className="text-gray-500">No source geometry returned for this area.</p>
        ) : null}
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
