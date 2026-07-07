"use client";

import { useState } from "react";
import { 
  Settings as SettingsIcon, 
  Layers, 
  Sliders, 
  Database,
  Lock,
  Globe,
  BellRing,
  HelpCircle,
  Save,
  Check
} from "lucide-react";

interface SettingsProps {
  showSatellite: boolean;
  setShowSatellite: (val: boolean) => void;
  showCatastro: boolean;
  setShowCatastro: (val: boolean) => void;
  showANP: boolean;
  setShowANP: (val: boolean) => void;
  showDeforestation: boolean;
  setShowDeforestation: (val: boolean) => void;
  showRivers: boolean;
  setShowRivers: (val: boolean) => void;
}

export default function Settings({
  showSatellite,
  setShowSatellite,
  showCatastro,
  setShowCatastro,
  showANP,
  setShowANP,
  showDeforestation,
  setShowDeforestation,
  showRivers,
  setShowRivers,
}: SettingsProps) {
  // Alert thresholds settings
  const [minAreaAlert, setMinAreaAlert] = useState<number>(0.5); // Hectares
  const [sentinelFrequency, setSentinelFrequency] = useState<string>("quincenal");
  const [webhookUrl, setWebhookUrl] = useState<string>("https://api.legalmine.com/v1/webhooks/alerts");
  
  // Save notification confirmation
  const [saved, setSaved] = useState<boolean>(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-2 pb-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Configuración del Sistema</h2>
        <p className="text-sm text-gray-400">Parámetros de teledetección, capas GIS y alertas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Map Layers Toggles Card */}
        <div className="glass-panel p-5 space-y-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-blue-400 animate-pulse" />
            Configuración de Capas GIS Predeterminadas
          </h3>
          <p className="text-xs text-gray-400">Activa o desactiva las superposiciones en el Visor de Mapas</p>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-gray-200">Mapa Satelital de Alta Resolución</span>
                <span className="text-[10px] text-gray-400">Servidor Esri World Imagery (Imágenes globales)</span>
              </div>
              <input 
                type="checkbox" 
                checked={showSatellite}
                onChange={(e) => setShowSatellite(e.target.checked)}
                className="w-9 h-5 bg-gray-700 rounded-full appearance-none checked:bg-blue-600 transition-colors relative before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-gray-200">Catastro Minero de INGEMMET</span>
                <span className="text-[10px] text-gray-400">Polígonos oficiales de concesiones mineras</span>
              </div>
              <input 
                type="checkbox" 
                checked={showCatastro}
                onChange={(e) => setShowCatastro(e.target.checked)}
                className="w-9 h-5 bg-gray-700 rounded-full appearance-none checked:bg-blue-600 transition-colors relative before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-gray-200">Áreas Naturales Protegidas (SERNANP)</span>
                <span className="text-[10px] text-gray-400">Zonas de reserva ecológica y amortiguamiento</span>
              </div>
              <input 
                type="checkbox" 
                checked={showANP}
                onChange={(e) => setShowANP(e.target.checked)}
                className="w-9 h-5 bg-gray-700 rounded-full appearance-none checked:bg-blue-600 transition-colors relative before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-gray-200">Capas de Deforestación GeoAI</span>
                <span className="text-[10px] text-gray-400">Pérdida de bosque y frentes de minería aluvial</span>
              </div>
              <input 
                type="checkbox" 
                checked={showDeforestation}
                onChange={(e) => setShowDeforestation(e.target.checked)}
                className="w-9 h-5 bg-gray-700 rounded-full appearance-none checked:bg-blue-600 transition-colors relative before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-gray-200">Ríos y Fajas Marginales (ANA)</span>
                <span className="text-[10px] text-gray-400">Riesgos hidrológicos y cercanía a cauces</span>
              </div>
              <input 
                type="checkbox" 
                checked={showRivers}
                onChange={(e) => setShowRivers(e.target.checked)}
                className="w-9 h-5 bg-gray-700 rounded-full appearance-none checked:bg-blue-600 transition-colors relative before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Algorithm Thresholds & API connections */}
        <div className="glass-panel p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-amber-500" />
              Sensibilidad del Sensor y Alertas (PRD 5.1)
            </h3>
            <p className="text-xs text-gray-400">Define las reglas para gatillar notificaciones automáticas</p>

            <div className="space-y-3">
              {/* Slider area threshold */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-200">Umbral Mínimo de Deforestación</span>
                  <span className="text-blue-400 font-bold">{minAreaAlert} Hectáreas (Ha)</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="5.0" 
                  step="0.1" 
                  value={minAreaAlert}
                  onChange={(e) => setMinAreaAlert(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[9px] text-gray-500 block leading-tight">Ignora aperturas de claros forestales de menor dimensión para evitar falsos positivos de caídas de árboles.</span>
              </div>

              {/* Freq selection */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-gray-200 block">Frecuencia de Monitoreo Satelital</span>
                <select 
                  value={sentinelFrequency}
                  onChange={(e) => setSentinelFrequency(e.target.value)}
                  className="w-full text-xs bg-white/5 border border-white/5 rounded-lg p-2.5 text-gray-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="diario" className="bg-[#0b0f19]">Diario (Copernicus Planet - Premium)</option>
                  <option value="quincenal" className="bg-[#0b0f19]">Quincenal (Sentinel-2 L2A - MVP Standard)</option>
                  <option value="mensual" className="bg-[#0b0f19]">Mensual (Landsat 9)</option>
                </select>
              </div>

              {/* Webhook endpoint */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-gray-200 block">Endpoint de Webhook para Integración (B2B)</span>
                <input 
                  type="text" 
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full text-xs bg-white/5 border border-white/5 rounded-lg p-2.5 text-gray-300 font-mono focus:outline-none focus:border-blue-500" 
                />
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition mt-4"
          >
            {saved ? (
              <>
                <Check className="h-4 w-4 text-white" />
                <span>¡Ajustes Guardados con Éxito!</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Guardar Parámetros Técnicos</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Database sync status */}
      <div className="glass-panel p-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
            <Database className="h-4 w-4 text-blue-400" /> Sincronización del Catastro Nacional
          </h4>
          <p className="text-[11px] text-gray-400">Estado de descarga de bases de datos del gobierno de Perú.</p>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center pb-1 border-b border-white/5">
            <span className="text-gray-400">INGEMMET (Catastro Minero):</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Actualizado ayer
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">MINEM (Registro REINFO):</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Actualizado hoy 6:00 AM
            </span>
          </div>
        </div>
        <div className="text-right">
          <button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold border border-blue-500/20 hover:border-blue-500/30 px-3 py-1.5 rounded-lg transition ml-auto">
            <span>Sincronizar Manualmente</span>
          </button>
        </div>
      </div>
    </div>
  );
}
