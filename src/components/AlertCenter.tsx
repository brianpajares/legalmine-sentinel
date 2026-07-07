"use client";

import { useState, useRef, useEffect } from "react";
import { 
  ShieldAlert, 
  MapPin, 
  Layers, 
  FileCheck, 
  Calendar,
  AlertTriangle,
  FileText,
  User,
  Activity,
  Calculator,
  Search,
  ExternalLink
} from "lucide-react";
import { MapConcession } from "./Map";

interface AlertCenterProps {
  concessions: MapConcession[];
  selectedConcessionId: string | null;
  onSelectConcession: (concession: MapConcession) => void;
}

export default function AlertCenter({
  concessions,
  selectedConcessionId,
  onSelectConcession
}: AlertCenterProps) {
  // Get non-opportunity concessions (actual mining rights or alerts)
  const alertsList = concessions.filter(c => !c.isOpportunity);
  
  // Set initially selected alert
  const [selectedAlert, setSelectedAlert] = useState<MapConcession>(
    alertsList.find(c => c.id === selectedConcessionId) || alertsList[0]
  );

  // Sync state if selectedConcessionId changes from outer context
  useEffect(() => {
    if (selectedConcessionId) {
      const match = alertsList.find(c => c.id === selectedConcessionId);
      if (match) {
        setSelectedAlert(match);
      }
    }
  }, [selectedConcessionId, alertsList]);

  // Before/After comparison slider percentage (0 to 100)
  const [sliderPos, setSliderPos] = useState<number>(50);
  const isDragging = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Score weights & checks (PRD 7.1)
  const [factors, setFactors] = useState({
    coverChange: true,
    miningFeatures: true,
    outsideConcession: true,
    anpZone: false,
    riverProximity: true,
    noReinfo: true,
    history: false,
  });

  // Update factors checkboxes depending on selected concession's risk configuration
  useEffect(() => {
    if (selectedAlert) {
      // Setup mock values for factors based on risk score
      if (selectedAlert.riskScore >= 80) {
        setFactors({
          coverChange: true,
          miningFeatures: true,
          outsideConcession: true,
          anpZone: selectedAlert.status === "Extinguido" || selectedAlert.name.includes("SANTA ELENA"),
          riverProximity: true,
          noReinfo: true,
          history: true,
        });
      } else if (selectedAlert.riskScore >= 60) {
        setFactors({
          coverChange: true,
          miningFeatures: true,
          outsideConcession: false,
          anpZone: false,
          riverProximity: true,
          noReinfo: true,
          history: false,
        });
      } else if (selectedAlert.riskScore >= 40) {
        setFactors({
          coverChange: true,
          miningFeatures: false,
          outsideConcession: false,
          anpZone: false,
          riverProximity: false,
          noReinfo: true,
          history: false,
        });
      } else {
        setFactors({
          coverChange: false,
          miningFeatures: false,
          outsideConcession: false,
          anpZone: false,
          riverProximity: false,
          noReinfo: false,
          history: false,
        });
      }
    }
  }, [selectedAlert]);

  // Calculate dynamic risk score based on checkboxes (PRD 7.1)
  const calculateDynamicScore = () => {
    let score = 0;
    if (factors.coverChange) score += 20;
    if (factors.miningFeatures) score += 20;
    if (factors.outsideConcession) score += 20;
    if (factors.anpZone) score += 15;
    if (factors.riverProximity) score += 10;
    if (factors.noReinfo) score += 10;
    if (factors.history) score += 5;
    return score;
  };

  const dynamicScore = calculateDynamicScore();

  // Slider interaction handlers
  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  };

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  useEffect(() => {
    const handleMouseUp = () => {
      isDragging.current = false;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchend", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // REINFO verification details based on risk
  const getReinfoStatus = (score: number) => {
    if (score >= 85) return { status: "NO INSCRITO / ILEGAL", color: "text-red-400 border-red-500/30 bg-red-950/30", details: "El RUC consultado no figura en el Registro Integral de Formalización Minera." };
    if (score >= 60) return { status: "SUSPENDIDO", color: "text-amber-400 border-amber-500/30 bg-amber-950/30", details: "Inscripción en REINFO suspendida por incumplimiento de requisitos ambientales (IGAOM/Aspecto Correctivo)." };
    return { status: "VIGENTE / FORMAL", color: "text-emerald-400 border-emerald-500/30 bg-emerald-950/30", details: "Inscripción vigente en REINFO. Minería artesanal/pequeña formalizada bajo supervisión del MINEM." };
  };

  const reinfo = selectedAlert ? getReinfoStatus(selectedAlert.riskScore) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
      
      {/* Column Left: Alert Directory (3/12 width) */}
      <div className="lg:col-span-3 glass-panel p-4 flex flex-col h-full overflow-hidden space-y-4">
        <div>
          <h3 className="font-bold text-base text-white">Directorio de Alertas</h3>
          <p className="text-xs text-gray-400">Derechos y actividades de riesgo</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {alertsList.map((alert) => {
            const isSelected = selectedAlert.id === alert.id;
            
            // Get color by risk
            let riskColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            if (alert.riskScore >= 80) riskColor = "bg-red-500/15 text-red-400 border-red-500/30";
            else if (alert.riskScore >= 60) riskColor = "bg-amber-500/15 text-amber-400 border-amber-500/30";
            else if (alert.riskScore >= 40) riskColor = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";

            return (
              <div
                key={alert.id}
                onClick={() => {
                  setSelectedAlert(alert);
                  onSelectConcession(alert);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected 
                    ? "bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/5 text-white" 
                    : "bg-white/5 border-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="font-bold text-xs truncate max-w-[120px]">{alert.name}</span>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${riskColor}`}>
                    {alert.riskScore}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-400">
                  <span>Cód: {alert.code}</span>
                  <span>{alert.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Column Center & Right: Dashboard Analysis (9/12 width) */}
      <div className="lg:col-span-9 flex flex-col h-full overflow-y-auto space-y-6 pr-2 pb-6">
        
        {/* Header Details */}
        <div className="flex justify-between items-start gap-4 flex-wrap bg-white/5 border border-white/5 rounded-xl p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-600/20 text-blue-400 font-semibold px-2 py-0.5 rounded border border-blue-500/30">
                Monitoreo Satelital
              </span>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Última actualización: 05 de Julio, 2026
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{selectedAlert.name}</h2>
            <div className="text-xs text-gray-400 flex flex-wrap gap-4">
              <span><strong>Código Catastral:</strong> {selectedAlert.code}</span>
              <span><strong>Titular:</strong> {selectedAlert.owner}</span>
              <span><strong>Sustancia:</strong> {selectedAlert.substance}</span>
              <span><strong>Área:</strong> {selectedAlert.area} Ha</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Estado de Alerta:</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              selectedAlert.riskScore >= 80 
                ? "bg-red-500/20 text-red-400 border-red-500/30 critical-pulse" 
                : selectedAlert.riskScore >= 60 
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            }`}>
              {selectedAlert.riskScore >= 80 ? "RIESGO CRÍTICO" : selectedAlert.riskScore >= 60 ? "RIESGO ALTO" : "RIESGO BAJO"}
            </span>
          </div>
        </div>

        {/* Satellite Imagery Slider & Risk Score Calculator */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Comparison Satellite Slider */}
          <div className="glass-panel p-5 space-y-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-400 animate-pulse" />
                Comparador Sentinel-2 L2A (Multitemporal)
              </h3>
              <p className="text-xs text-gray-400">Arrastra el selector para comparar el cambio de cobertura</p>
            </div>

            {/* Slider visual component */}
            <div 
              ref={containerRef}
              className="comparison-slider-container w-full aspect-[4/3] relative border border-white/10"
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
            >
              {/* Before layer (Prisinte Forest) */}
              <div className="absolute inset-0 bg-[#0c2310] overflow-hidden flex flex-col justify-end p-3 z-0">
                {/* Simulated Forest Map */}
                <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="#143c1a" />
                  {/* river */}
                  <path d="M-10,40 Q80,120 180,60 T400,200" fill="none" stroke="#1d4ed8" strokeWidth="24" />
                  <path d="M-10,40 Q80,120 180,60 T400,200" fill="none" stroke="#3b82f6" strokeWidth="18" />
                  {/* forest texture */}
                  <circle cx="50" cy="50" r="25" fill="#0c2310" opacity="0.3"/>
                  <circle cx="150" cy="210" r="40" fill="#091a0c" opacity="0.3"/>
                  <circle cx="320" cy="90" r="30" fill="#0d2e14" opacity="0.3"/>
                </svg>
                <span className="text-[10px] font-bold bg-[#070a13]/80 border border-white/10 px-2 py-0.5 rounded text-emerald-400 z-10 w-fit">
                  ANTES: Julio 2024 (Bosque Intacto)
                </span>
              </div>

              {/* After layer (Deforestation) */}
              <div 
                className="absolute inset-0 bg-[#3f392b] overflow-hidden flex flex-col justify-end p-3 z-10"
                style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100, 0 100)` }}
              >
                {/* Simulated Mining deforested Map */}
                <svg className="absolute inset-0 w-full h-full opacity-90" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="#1e2e18" />
                  {/* Deforested area (Beige/Sand) */}
                  <path d="M 80,120 Q 150,150 250,130 T 350,220" fill="none" stroke="#d4c5a1" strokeWidth="60" strokeLinecap="round" />
                  <path d="M 120,60 Q 200,90 280,140" fill="none" stroke="#d4c5a1" strokeWidth="40" strokeLinecap="round" />
                  
                  {/* river turbid */}
                  <path d="M-10,40 Q80,120 180,60 T400,200" fill="none" stroke="#78350f" strokeWidth="24" />
                  <path d="M-10,40 Q80,120 180,60 T400,200" fill="none" stroke="#b45309" strokeWidth="18" />
                  
                  {/* ponds (artificial pools) */}
                  <ellipse cx="140" cy="110" rx="20" ry="12" fill="#84cc16" stroke="#d4d4d8" strokeWidth="2" />
                  <ellipse cx="180" cy="140" rx="35" ry="18" fill="#a3e635" stroke="#e4e4e7" strokeWidth="2.5" />
                  <ellipse cx="270" cy="160" rx="15" ry="10" fill="#4d7c0f" stroke="#a1a1aa" strokeWidth="2" />
                  
                  {/* trails */}
                  <path d="M 80,120 L 50,200 M 180,140 L 190,260" stroke="#f5e0b3" strokeWidth="3" strokeDasharray="3,3" />
                </svg>
                <span className="text-[10px] font-bold bg-[#070a13]/80 border border-white/10 px-2 py-0.5 rounded text-red-400 z-10 w-fit">
                  AHORA: Julio 2026 (Presencia de Pozas y Deforestación)
                </span>
              </div>

              {/* Slider Handle */}
              <div 
                className="slider-handle"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="slider-handle-button">
                  <Activity className="h-4 w-4 text-white rotate-90" />
                </div>
              </div>
            </div>
            
            {/* Visual Indicator of NDVI / NDWI Indexes */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/5 border border-white/5 p-2 rounded-lg">
                <span className="text-gray-400 font-medium block">Pérdida de NDVI:</span>
                <span className="text-red-400 font-bold">-0.48 (Deforestación)</span>
              </div>
              <div className="bg-white/5 border border-white/5 p-2 rounded-lg">
                <span className="text-gray-400 font-medium block">Detección NDWI:</span>
                <span className="text-blue-400 font-bold">+0.32 (Presencia de Agua)</span>
              </div>
            </div>
          </div>

          {/* Interactive Calculator Score (PRD 7.1) */}
          <div className="glass-panel p-5 space-y-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-400" />
                Calculadora de Riesgo GeoAI (Mining Risk Score)
              </h3>
              <p className="text-xs text-gray-400">Ponderaciones del PRD. Modifica los factores observados para recalcular el riesgo.</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs text-gray-200 cursor-pointer hover:bg-white/10 transition">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={factors.coverChange}
                    onChange={(e) => setFactors({...factors, coverChange: e.target.checked})}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" 
                  />
                  <span>Cambio reciente de cobertura</span>
                </div>
                <span className="font-semibold text-gray-400">20%</span>
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs text-gray-200 cursor-pointer hover:bg-white/10 transition">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={factors.miningFeatures}
                    onChange={(e) => setFactors({...factors, miningFeatures: e.target.checked})}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" 
                  />
                  <span>Pozas / Caminos / Suelo Desnudo</span>
                </div>
                <span className="font-semibold text-gray-400">20%</span>
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs text-gray-200 cursor-pointer hover:bg-white/10 transition">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={factors.outsideConcession}
                    onChange={(e) => setFactors({...factors, outsideConcession: e.target.checked})}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" 
                  />
                  <span>Fuera de Concesión Titulada</span>
                </div>
                <span className="font-semibold text-gray-400">20%</span>
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs text-gray-200 cursor-pointer hover:bg-white/10 transition">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={factors.anpZone}
                    onChange={(e) => setFactors({...factors, anpZone: e.target.checked})}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" 
                  />
                  <span>Superposición con ANP / Zona Sensible</span>
                </div>
                <span className="font-semibold text-gray-400">15%</span>
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs text-gray-200 cursor-pointer hover:bg-white/10 transition">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={factors.riverProximity}
                    onChange={(e) => setFactors({...factors, riverProximity: e.target.checked})}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" 
                  />
                  <span>Cercanía a Cuerpos de Agua / Ríos</span>
                </div>
                <span className="font-semibold text-gray-400">10%</span>
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs text-gray-200 cursor-pointer hover:bg-white/10 transition">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={factors.noReinfo}
                    onChange={(e) => setFactors({...factors, noReinfo: e.target.checked})}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" 
                  />
                  <span>Sin Registro REINFO Activo</span>
                </div>
                <span className="font-semibold text-gray-400">10%</span>
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs text-gray-200 cursor-pointer hover:bg-white/10 transition">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={factors.history}
                    onChange={(e) => setFactors({...factors, history: e.target.checked})}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" 
                  />
                  <span>Historial Previo de Reincidencia</span>
                </div>
                <span className="font-semibold text-gray-400">5%</span>
              </label>
            </div>

            {/* Calculated Risk Display */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 font-semibold block uppercase">Mining Risk Score (Simulado)</span>
                <span className={`text-2xl font-extrabold ${
                  dynamicScore >= 80 ? "text-red-500" : dynamicScore >= 60 ? "text-amber-500" : "text-emerald-400"
                }`}>{dynamicScore}%</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-semibold block uppercase">Clasificación</span>
                <span className={`text-sm font-bold ${
                  dynamicScore >= 80 ? "text-red-400" : dynamicScore >= 60 ? "text-amber-400" : "text-emerald-400"
                }`}>
                  {dynamicScore >= 80 ? "Riesgo Crítico" : dynamicScore >= 60 ? "Riesgo Alto" : dynamicScore >= 40 ? "Riesgo Medio" : "Riesgo Bajo"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Context & External Lookup (REINFO & SIDEMCAT) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* REINFO query card */}
          <div className="glass-panel p-5 space-y-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-amber-500" />
                Validación de Inscripción REINFO (MINEM)
              </h3>
              <p className="text-xs text-gray-400">Cruce oficial del Registro Integral de Formalización Minera</p>
            </div>

            {reinfo && (
              <div className="space-y-4">
                <div className={`p-3 rounded-xl border ${reinfo.color} text-xs`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-bold">Estado REINFO:</span>
                    <span className="font-extrabold uppercase px-2 py-0.5 rounded bg-black/40">{reinfo.status}</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{reinfo.details}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-1">
                    <span className="text-gray-400">Código Único de Derecho:</span>
                    <span className="text-gray-200 font-semibold">{selectedAlert.code}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-1">
                    <span className="text-gray-400">Nombre de Declarante:</span>
                    <span className="text-gray-200 font-semibold">{selectedAlert.owner}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-1">
                    <span className="text-gray-400">Última validación automática:</span>
                    <span className="text-gray-200 font-semibold">Hoy, 12:45 PM</span>
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition">
                  <Search className="h-3.5 w-3.5" />
                  <span>Consultar Registro Completo (MINEM Portal)</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* SIDEMCAT Details & Legal Actions */}
          <div className="glass-panel p-5 space-y-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                Expediente SIDEMCAT (INGEMMET)
              </h3>
              <p className="text-xs text-gray-400">Datos legales y resoluciones del catastro minero</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-2 rounded bg-white/5 border border-white/5 text-xs">
                <User className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-200 block">Titular Concesionario</span>
                  <span className="text-gray-400">{selectedAlert.owner}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2 rounded bg-white/5 border border-white/5 text-xs">
                <FileText className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-200 block">Resolución de Presidencia</span>
                  <span className="text-gray-400">R.P. Nº 2085-2021-INGEMMET/PE/PM (Fecha: 14/10/2021)</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2 rounded bg-white/5 border border-white/5 text-xs">
                <AlertTriangle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-200 block">Compromisos y Obligaciones</span>
                  <span className="text-emerald-400 font-medium">Derecho de Vigencia Pagado hasta 2026. Sin penalidades.</span>
                </div>
              </div>

              {/* Legal Disclaimer Box */}
              <div className="p-2.5 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-[10px] text-yellow-400 leading-relaxed">
                <strong>Disclaimer Legal Importante (PRD 2):</strong> LegalMine Sentinel entrega indicios de actividad y riesgos en base a análisis de teledetección. Esta alerta no representa una acusación delictiva. Se requiere inspección física o peritaje oficial para corroboración final.
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
