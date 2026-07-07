"use client";

import { useState } from "react";
import { 
  ShieldAlert, 
  Upload, 
  Search, 
  Plus, 
  MapPin, 
  Activity,
  Layers,
  HelpCircle,
  FileCheck,
  AlertTriangle
} from "lucide-react";
import Sidebar from "./Sidebar";
import Overview from "./Overview";
import MapWrapper from "./MapWrapper";
import { MapConcession } from "./Map";
import AlertCenter from "./AlertCenter";
import OpportunityRadar from "./OpportunityRadar";
import DossierExporter from "./DossierExporter";
import Settings from "./Settings";

const INITIAL_CONCESSIONS: MapConcession[] = [
  {
    id: "con-1",
    name: "ZAPOTAL 1",
    code: "010293821",
    status: "Titulado",
    owner: "INVERSIONES MINERAS PAMPA S.A.C.",
    substance: "Metálica",
    area: 500,
    riskScore: 85,
    coordinates: [
      [-12.90, -69.85],
      [-12.92, -69.85],
      [-12.92, -69.82],
      [-12.90, -69.82],
    ],
  },
  {
    id: "con-2",
    name: "ACUMULACION LOS ANDES",
    code: "010398222",
    status: "Titulado",
    owner: "MINERA AURIFERA DEL SUR E.I.R.L.",
    substance: "Metálica",
    area: 1200,
    riskScore: 24,
    coordinates: [
      [-12.82, -69.95],
      [-12.85, -69.95],
      [-12.85, -69.90],
      [-12.82, -69.90],
    ],
  },
  {
    id: "con-3",
    name: "MINA DE ORO TRES AMIGOS",
    code: "010482923",
    status: "En Trámite",
    owner: "CONSORCIO MINERO AMAZONICO S.A.",
    substance: "Metálica",
    area: 350,
    riskScore: 68,
    coordinates: [
      [-12.94, -69.90],
      [-12.96, -69.90],
      [-12.96, -69.87],
      [-12.94, -69.87],
    ],
  },
  {
    id: "opp-1",
    name: "SECTOR INAMBARI LIBRE",
    code: "PET-2026-001",
    status: "Libre",
    owner: "Estado Peruano (Libre Disponibilidad)",
    substance: "Metálica",
    area: 400,
    riskScore: 0,
    opportunityScore: 84,
    isOpportunity: true,
    coordinates: [
      [-12.86, -69.80],
      [-12.89, -69.80],
      [-12.89, -69.76],
      [-12.86, -69.76],
    ],
    description: "Zona colindante a actividad minera formal, fuera de áreas naturales protegidas (ANP) y comunidades nativas. Alta viabilidad geológica para formular nuevo petitorio de concesión."
  },
  {
    id: "opp-2",
    name: "CONCESION COMPRA VERDE",
    code: "010928725",
    status: "Titulado",
    owner: "COMPANIA MINERA SAN RAMON S.A.",
    substance: "Metálica",
    area: 600,
    riskScore: 12,
    opportunityScore: 76,
    isOpportunity: true,
    coordinates: [
      [-12.97, -69.64],
      [-12.99, -69.64],
      [-12.99, -69.60],
      [-12.97, -69.60],
    ],
    description: "Concesión titulada de titular inactivo. Bajo conflicto socioambiental, ideal para negociar un contrato de Joint Venture (JV) o transferencia de derecho minero."
  }
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [concessions, setConcessions] = useState<MapConcession[]>(INITIAL_CONCESSIONS);
  const [selectedConcession, setSelectedConcession] = useState<MapConcession | null>(null);
  
  // Search bar input
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Map settings state (shared with Settings view)
  const [showSatellite, setShowSatellite] = useState<boolean>(true);
  const [showCatastro, setShowCatastro] = useState<boolean>(true);
  const [showANP, setShowANP] = useState<boolean>(true);
  const [showDeforestation, setShowDeforestation] = useState<boolean>(true);
  const [showRivers, setShowRivers] = useState<boolean>(true);

  // Map coordinates (starts focused on Tambopata/La Pampa department of Madre de Dios)
  const [mapCenter, setMapCenter] = useState<[number, number]>([-12.90, -69.83]);
  const [mapZoom, setMapZoom] = useState<number>(11);

  // Navigation controller helper
  const handleNavigateToTab = (tab: string, concessionId?: string) => {
    setActiveTab(tab);
    if (concessionId) {
      const match = concessions.find(c => c.id === concessionId);
      if (match) {
        setSelectedConcession(match);
        // Pan map if clicking to view map details
        setMapCenter(match.coordinates[0]);
        setMapZoom(12);
      }
    }
  };

  // Selector callback for map polygons click
  const handleSelectConcession = (concession: MapConcession) => {
    setSelectedConcession(concession);
    setMapCenter(concession.coordinates[0]);
    
    // Auto shift to appropriate tab depending on selection type
    if (concession.isOpportunity) {
      setActiveTab("radar");
    } else {
      setActiveTab("alerts");
    }
  };

  // Handle concession search in header
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    const match = concessions.find(
      c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           c.code.includes(searchQuery)
    );

    if (match) {
      handleSelectConcession(match);
      setSearchQuery("");
    } else {
      alert(`Derecho "${searchQuery}" no encontrado en el catastro local.`);
    }
  };

  // File Upload handler (KML / GeoJSON parser)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        
        let newConcession: MapConcession;

        if (file.name.endsWith(".geojson") || file.name.endsWith(".json")) {
          const geojson = JSON.parse(text);
          const name = geojson.properties?.name || file.name.replace(/\.[^/.]+$/, "");
          const code = geojson.properties?.code || Math.floor(10000000 + Math.random() * 90000000).toString();
          
          // Try to parse polygon coords
          const coords = geojson.features?.[0]?.geometry?.coordinates?.[0] || 
                         geojson.geometry?.coordinates?.[0];
          
          if (!coords) throw new Error("No se encontraron coordenadas válidas de polígono.");

          // convert from [lon, lat] to [lat, lon]
          const mappedCoords = coords.map((c: [number, number]) => [c[1], c[0]]) as [number, number][];
          
          newConcession = {
            id: `uploaded-${Date.now()}`,
            name: name.toUpperCase(),
            code: code,
            status: "Titulado",
            owner: "CONCESIONARIO CONSULTADO (CARGA KML)",
            substance: "Metálica",
            area: Math.round(geojson.properties?.area || 450),
            riskScore: Math.floor(Math.random() * 90) + 10,
            coordinates: mappedCoords
          };
        } else if (file.name.endsWith(".kml")) {
          // Parse KML using DOMParser
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");
          const coordsStr = xmlDoc.getElementsByTagName("coordinates")[0]?.textContent;
          const name = xmlDoc.getElementsByTagName("name")[0]?.textContent || file.name.replace(/\.[^/.]+$/, "");
          
          if (!coordsStr) throw new Error("No se encontraron coordenadas en el archivo KML.");

          // Coordinates in KML are formatted as "lon,lat,alt lon,lat,alt..."
          const coords = coordsStr.trim().split(/\s+/).map(pair => {
            const parts = pair.split(",");
            return [parseFloat(parts[1]), parseFloat(parts[0])] as [number, number];
          }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

          if (coords.length === 0) throw new Error("Coordenadas KML inválidas.");

          newConcession = {
            id: `uploaded-${Date.now()}`,
            name: name.toUpperCase(),
            code: Math.floor(10000000 + Math.random() * 90000000).toString(),
            status: "Titulado",
            owner: "CONCESIONARIO SUBIDO (KML)",
            substance: "Metálica",
            area: 300,
            riskScore: Math.floor(Math.random() * 70) + 20,
            coordinates: coords
          };
        } else {
          throw new Error("Formato no soportado. Sube archivos .kml, .geojson o .json.");
        }

        // Append to local state and center map
        setConcessions(prev => [newConcession, ...prev]);
        setSelectedConcession(newConcession);
        setMapCenter(newConcession.coordinates[0]);
        setMapZoom(12);
        
        // Notify success
        alert(`¡Carga exitosa! Concesión "${newConcession.name}" agregada al monitoreo local en el Visor GIS.`);
      } catch (err: any) {
        alert(`Error al procesar archivo: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const alertCount = concessions.filter(c => !c.isOpportunity && c.riskScore >= 40).length;
  const opportunityCount = concessions.filter(c => c.isOpportunity).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070a13] text-[#f3f4f6]">
      {/* Sidebar navigation panel */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        alertCount={alertCount}
        opportunityCount={opportunityCount}
      />

      {/* Main Content Workspace Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden print:overflow-visible">
        
        {/* Workspace Top Header (hidden on print) */}
        <header className="h-16 border-b border-white/10 bg-[#0b0f19]/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20 print:hidden">
          {/* Concession Search query */}
          <form onSubmit={handleSearch} className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar concesión por código o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/5 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </form>

          {/* Action buttons (Upload KML/GeoJSON) */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl cursor-pointer transition shadow-lg shadow-blue-500/20">
              <Upload className="h-4 w-4" />
              <span>Cargar Polígono (KML/GeoJSON)</span>
              <input
                type="file"
                accept=".kml,.geojson,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <span className="h-4 w-[1px] bg-white/10"></span>
            
            {/* System clock / locale info */}
            <div className="text-right text-[10px] text-gray-500 font-medium">
              <div>SISTEMA LEGALMINE</div>
              <div>V1.0 - PROTOTIPO PREMIUM</div>
            </div>
          </div>
        </header>

        {/* Content Workspace switcher */}
        <main className="flex-1 p-6 overflow-hidden relative print:p-0 print:overflow-visible">
          {activeTab === "overview" && (
            <Overview 
              concessions={concessions} 
              onNavigateToTab={handleNavigateToTab} 
            />
          )}

          {activeTab === "map" && (
            <div className="w-full h-full flex flex-col gap-4">
              <div className="flex justify-between items-center print:hidden">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Visor Catastral y Ambiental (GeoAI)</h2>
                  <p className="text-xs text-gray-400">Monitoreo satelital activo en el departamento de Madre de Dios</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowSatellite(prev => !prev)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${
                      showSatellite ? "bg-blue-600/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/5 text-gray-400"
                    }`}
                  >
                    Capa Satelital
                  </button>
                  <button 
                    onClick={() => setShowCatastro(prev => !prev)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${
                      showCatastro ? "bg-blue-600/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/5 text-gray-400"
                    }`}
                  >
                    Ver Catastro
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <MapWrapper 
                  concessions={concessions}
                  selectedConcession={selectedConcession}
                  onSelectConcession={handleSelectConcession}
                  center={mapCenter}
                  zoom={mapZoom}
                  showSatellite={showSatellite}
                  showCatastro={showCatastro}
                  showANP={showANP}
                  showDeforestation={showDeforestation}
                  showRivers={showRivers}
                />
              </div>
            </div>
          )}

          {activeTab === "alerts" && (
            <AlertCenter 
              concessions={concessions} 
              selectedConcessionId={selectedConcession?.id || null}
              onSelectConcession={handleSelectConcession}
            />
          )}

          {activeTab === "radar" && (
            <OpportunityRadar 
              concessions={concessions}
              selectedConcessionId={selectedConcession?.id || null}
              onSelectConcession={handleSelectConcession}
            />
          )}

          {activeTab === "dossier" && (
            <DossierExporter concessions={concessions} />
          )}

          {activeTab === "settings" && (
            <Settings 
              showSatellite={showSatellite}
              setShowSatellite={setShowSatellite}
              showCatastro={showCatastro}
              setShowCatastro={setShowCatastro}
              showANP={showANP}
              setShowANP={setShowANP}
              showDeforestation={showDeforestation}
              setShowDeforestation={setShowDeforestation}
              showRivers={showRivers}
              setShowRivers={setShowRivers}
            />
          )}
        </main>

      </div>
    </div>
  );
}
