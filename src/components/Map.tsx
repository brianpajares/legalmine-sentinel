"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Leaflet CSS fix for icons in Webpack/Next.js
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
};

// Component to dynamically pan and zoom the map when requested
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export interface MapConcession {
  id: string;
  name: string;
  code: string;
  status: "Titulado" | "En Trámite" | "Extinguido" | "Libre";
  owner: string;
  substance: string;
  area: number;
  riskScore: number;
  opportunityScore?: number;
  coordinates: [number, number][];
  description?: string;
  isOpportunity?: boolean;
}

interface MapProps {
  concessions: MapConcession[];
  selectedConcession: MapConcession | null;
  onSelectConcession: (concession: MapConcession) => void;
  center: [number, number];
  zoom: number;
  showSatellite: boolean;
  showCatastro: boolean;
  showANP: boolean;
  showDeforestation: boolean;
  showRivers: boolean;
}

export default function Map({
  concessions,
  selectedConcession,
  onSelectConcession,
  center,
  zoom,
  showSatellite,
  showCatastro,
  showANP,
  showDeforestation,
  showRivers,
}: MapProps) {
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  // Madre de Dios Tambopata Area base
  // ANP Tambopata Reserve Polygons (simplified)
  const anpPolygons = [
    [
      [-12.95, -69.95],
      [-13.15, -69.95],
      [-13.15, -69.65],
      [-12.95, -69.65],
    ] as [number, number][],
  ];

  // River buffers simulated paths (Rio Inambari / Malinowski area)
  const riverPaths = [
    [-12.85, -69.98],
    [-12.88, -69.92],
    [-12.92, -69.86],
    [-12.96, -69.75],
    [-12.98, -69.65],
  ] as [number, number][];

  // Deforestation spots inside risk concessions
  const deforestationSpots = [
    { center: [-12.915, -69.835] as [number, number], radius: 450, desc: "Apertura de camino forestal y suelo desnudo" },
    { center: [-12.912, -69.840] as [number, number], radius: 300, desc: "Pérdida de bosque y pozas de lavado aluvial" },
    { center: [-12.925, -69.815] as [number, number], radius: 600, desc: "Deforestación activa en zona de amortiguamiento" },
    { center: [-12.980, -69.720] as [number, number], radius: 800, desc: "Pozas artificiales y dragado ilegal dentro de ANP" },
  ];

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/10 relative">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        {/* Map Controller to zoom/pan */}
        <MapController center={center} zoom={zoom} />

        {/* Tile Layers */}
        {showSatellite ? (
          <TileLayer
            attribution='&copy; Esri, Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
          />
        )}

        {/* ANP Tambopata Reserve Overlay */}
        {showANP &&
          anpPolygons.map((poly, index) => (
            <Polygon
              key={`anp-${index}`}
              positions={poly}
              pathOptions={{
                fillColor: "#065f46",
                fillOpacity: 0.35,
                color: "#059669",
                weight: 2,
                dashArray: "5, 10",
              }}
            >
              <Popup>
                <div className="text-xs p-1">
                  <h4 className="font-bold text-emerald-400">Reserva Nacional Tambopata (ANP)</h4>
                  <p className="text-gray-300">Zona protegida de máxima restricción ambiental. Actividad minera prohibida por ley.</p>
                </div>
              </Popup>
            </Polygon>
          ))}

        {/* Deforestation Spots Overlay */}
        {showDeforestation &&
          deforestationSpots.map((spot, index) => (
            <Circle
              key={`defor-${index}`}
              center={spot.center}
              radius={spot.radius}
              pathOptions={{
                fillColor: "#ef4444",
                fillOpacity: 0.4,
                color: "#b91c1c",
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs p-1">
                  <h4 className="font-bold text-red-400">Alerta de Deforestación</h4>
                  <p className="text-gray-300">{spot.desc}</p>
                  <p className="text-gray-400 text-[10px] mt-1">Fuente: Sentinel-2 / GeoAI (Monitoreo Quincenal)</p>
                </div>
              </Popup>
            </Circle>
          ))}

        {/* Concessions / Catastro Overlay */}
        {showCatastro &&
          concessions.map((concession) => {
            const isSelected = selectedConcession?.id === concession.id;
            
            // Get color based on status or opportunity
            let fillColor = "#3b82f6"; // Blue titled default
            let outlineColor = "#1d4ed8";
            
            if (concession.isOpportunity) {
              fillColor = "#10b981"; // Emerald green for opportunities
              outlineColor = "#047857";
            } else if (concession.status === "Extinguido") {
              fillColor = "#6b7280"; // Gray for extinguished
              outlineColor = "#374151";
            } else if (concession.status === "En Trámite") {
              fillColor = "#f59e0b"; // Orange/Amber
              outlineColor = "#d97706";
            } else if (concession.riskScore > 75) {
              fillColor = "#ef4444"; // Red for critical risk
              outlineColor = "#b91c1c";
            }

            return (
              <Polygon
                key={concession.id}
                positions={concession.coordinates}
                eventHandlers={{
                  click: () => onSelectConcession(concession),
                }}
                pathOptions={{
                  fillColor: fillColor,
                  fillOpacity: isSelected ? 0.6 : 0.25,
                  color: isSelected ? "#ffffff" : outlineColor,
                  weight: isSelected ? 3 : 1.5,
                }}
              >
                <Popup>
                  <div className="text-xs p-1">
                    <h3 className="font-bold text-base text-gray-100">{concession.name}</h3>
                    <p className="text-gray-400">Código: <span className="text-gray-200">{concession.code}</span></p>
                    <p className="text-gray-400">Estado: 
                      <span className={`ml-1 font-semibold ${
                        concession.status === "Titulado" ? "text-blue-400" :
                        concession.status === "En Trámite" ? "text-amber-400" : "text-gray-400"
                      }`}>
                        {concession.status}
                      </span>
                    </p>
                    {concession.isOpportunity ? (
                      <p className="text-emerald-400 font-bold mt-1">⭐ Oportunidad Minera Detectada</p>
                    ) : (
                      <p className="text-gray-400">Riesgo: 
                        <span className={`ml-1 font-semibold ${
                          concession.riskScore > 75 ? "text-red-400" :
                          concession.riskScore > 40 ? "text-amber-400" : "text-green-400"
                        }`}>
                          {concession.riskScore}%
                        </span>
                      </p>
                    )}
                    <button 
                      className="mt-2 w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded text-[11px] transition"
                      onClick={() => onSelectConcession(concession)}
                    >
                      Analizar Detalles
                    </button>
                  </div>
                </Popup>
              </Polygon>
            );
          })}
      </MapContainer>
    </div>
  );
}
