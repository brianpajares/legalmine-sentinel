"use client";

import { useEffect, useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, Geometry } from "geojson";
import { AlertTriangle, CheckCircle2, ExternalLink, Layers, MapPinned } from "lucide-react";

import type { SourceStatusSummary } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";
import type { GeoGeometry, Position } from "@/types/geo";
import { formatTimestamp, STATUS_LABELS, TIER_LABELS } from "@/lib/ui/format";

/**
 * Evidence map.
 *
 * Every layer drawn here comes from an assessment's evidence: the area of
 * interest the user supplied, plus the geometries returned by the sources.
 * There are no decorative or illustrative overlays: if a shape is on the map,
 * it has an evidence record and a source badge behind it.
 */

interface AssessmentMapProps {
  aoi: GeoGeometry;
  evidence: Evidence[];
  sources: SourceStatusSummary[];
  center: Position;
  onSelectEvidence?: (evidence: Evidence) => void;
}

const SOURCE_STYLE: Record<string, { color: string; label: string }> = {
  ingemmet: { color: "#38bdf8", label: "Derechos mineros" },
  sernanp: { color: "#34d399", label: "Areas protegidas" },
  reinfo: { color: "#f59e0b", label: "REINFO" },
  bdpi: { color: "#c084fc", label: "Contexto territorial" },
  ana: { color: "#22d3ee", label: "Agua / ANA" },
  copernicus: { color: "#f472b6", label: "Satelital" },
};

const FALLBACK_STYLE = { color: "#94a3b8", label: "Otra evidencia" };

function FitBounds({ aoi }: { aoi: GeoGeometry }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.geoJSON(aoi as unknown as Geometry);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [90, 420], maxZoom: 14 });
  }, [aoi, map]);
  return null;
}

export default function AssessmentMap({
  aoi,
  evidence,
  sources,
  center,
  onSelectEvidence,
}: AssessmentMapProps) {
  const geometryEvidence = useMemo(
    () => evidence.filter((item): item is Evidence & { geometry: GeoGeometry } => Boolean(item.geometry)),
    [evidence],
  );
  const findings = useMemo(() => evidence.filter((item) => item.kind === "finding"), [evidence]);
  const answeredSources = sources.filter((source) => source.status === "OK" || source.status === "STALE");
  const mappedSourceKeys = new Set(geometryEvidence.map((item) => item.sourceKey));

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10 shadow-2xl">
      <MapContainer
        center={[center[1], center[0]]}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="Imagery &copy; Esri - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <FitBounds aoi={aoi} />

        {geometryEvidence.map((item) => {
          const sourceStyle = SOURCE_STYLE[item.sourceKey] ?? FALLBACK_STYLE;
          const color = sourceStyle.color;
          return (
            <GeoJSON
              key={item.id}
              data={item.geometry as unknown as Feature}
              style={{
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: item.sourceKey === "reinfo" ? 0.42 : item.tier === "demo" ? 0.06 : 0.1,
                dashArray: item.tier === "demo" ? "6 6" : undefined,
              }}
              eventHandlers={{ click: () => onSelectEvidence?.(item) }}
              onEachFeature={(_feature, layer) => {
                layer.bindPopup(
                  `<div style="font-size:11px;line-height:1.5;max-width:280px">
                     <strong>${escapeHtml(item.title)}</strong><br/>
                     <span style="opacity:.75">${escapeHtml(item.sourceName)}</span><br/>
                     <span style="opacity:.75">${escapeHtml(STATUS_LABELS[item.status])} - ${escapeHtml(TIER_LABELS[item.tier])} - consultado ${escapeHtml(formatTimestamp(item.fetchedAt))}</span><br/>
                     <span style="opacity:.75">ID: ${escapeHtml(item.id)}</span>
                   </div>`,
                );
              }}
            />
          );
        })}

        <GeoJSON
          data={aoi as unknown as Feature}
          style={{ color: "#ffffff", weight: 4, fillColor: "#ffffff", fillOpacity: 0.03 }}
        />
      </MapContainer>

      <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-md rounded-lg border border-white/15 bg-[#070a13]/90 px-4 py-3 text-xs text-gray-200 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-200">
            <MapPinned className="h-4 w-4" />
          </span>
          <div>
            <p className="font-bold text-white">Mapa de evidencia analizada</p>
            <p className="mt-1 leading-relaxed text-gray-400">
              Contorno blanco = area evaluada. Las capas de color son registros oficiales o
              referenciales que respondieron y quedaron congelados como evidencia.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Fuentes" value={`${answeredSources.length}/${sources.length}`} />
          <Metric label="Hallazgos" value={String(findings.length)} />
          <Metric label="Geometrias" value={String(geometryEvidence.length)} />
        </div>
      </div>

      <aside className="absolute bottom-4 right-4 top-4 z-[500] flex w-[360px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-white/15 bg-[#070a13]/92 shadow-2xl backdrop-blur">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-300" />
            <h3 className="text-sm font-bold text-white">Que se reviso</h3>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
            Cada fila representa una fuente consultada. Si tiene geometria, se dibuja en el mapa y
            puede abrirse como evidencia.
          </p>
        </div>

        <div className="space-y-2 overflow-y-auto px-4 py-3">
          {sources.map((source) => {
            const sourceFindings = findings.filter((item) => item.sourceKey === source.sourceKey);
            const sourceGeometries = geometryEvidence.filter((item) => item.sourceKey === source.sourceKey);
            const sourceStyle = SOURCE_STYLE[source.sourceKey] ?? FALLBACK_STYLE;
            const mapped = mappedSourceKeys.has(source.sourceKey);
            return (
              <section key={source.sourceKey} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-bold text-white">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: mapped ? sourceStyle.color : "#64748b" }}
                      />
                      {sourceStyle.label}
                    </p>
                    <p className="mt-1 truncate text-[10px] text-gray-500">{source.sourceName}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-300">
                    {STATUS_LABELS[source.status]}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-gray-400">
                  <MiniMetric label="Reg." value={String(source.recordCount)} />
                  <MiniMetric label="Hall." value={String(sourceFindings.length)} />
                  <MiniMetric label="Mapa" value={String(sourceGeometries.length)} />
                </div>
                {source.warnings.length > 0 ? (
                  <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {source.warnings[0]}
                  </p>
                ) : source.status === "OK" || source.status === "STALE" ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Fuente consultada y registrada en el analisis.
                  </p>
                ) : null}
              </section>
            );
          })}

          <div className="pt-1">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Evidencia con geometria
            </p>
            {geometryEvidence.length === 0 ? (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-gray-500">
                Ninguna fuente devolvio geometria superpuesta. El area se evaluo, pero no hay capas
                espaciales para dibujar en este resultado.
              </p>
            ) : (
              <div className="space-y-2">
                {geometryEvidence.slice(0, 8).map((item) => {
                  const sourceStyle = SOURCE_STYLE[item.sourceKey] ?? FALLBACK_STYLE;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectEvidence?.(item)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-blue-400/40 hover:bg-blue-500/10"
                    >
                      <p className="flex items-start gap-2 text-[11px] font-semibold text-white">
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: sourceStyle.color }}
                        />
                        <span className="line-clamp-2">{item.title}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                        {item.id}
                        <ExternalLink className="h-3 w-3" />
                      </p>
                    </button>
                  );
                })}
                {geometryEvidence.length > 8 ? (
                  <p className="text-[10px] text-gray-500">
                    +{geometryEvidence.length - 8} geometrias adicionales registradas en evidencia.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-lg border border-white/15 bg-[#070a13]/90 px-3 py-2 text-[10px] leading-relaxed text-gray-300 backdrop-blur">
        <p className="mb-1 font-bold uppercase tracking-wider text-gray-400">Leyenda</p>
        <p>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-white bg-transparent" /> Area
          evaluada
        </p>
        {Object.entries(SOURCE_STYLE)
          .filter(([key]) => mappedSourceKeys.has(key))
          .map(([key, sourceStyle]) => (
            <p key={key}>
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: sourceStyle.color }}
              />
              {sourceStyle.label}
            </p>
          ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-white">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/15 px-2 py-1">
      <span className="text-gray-500">{label}</span>{" "}
      <span className="font-bold text-gray-200">{value}</span>
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
