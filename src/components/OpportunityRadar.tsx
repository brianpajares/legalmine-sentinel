"use client";

import { useState, useEffect } from "react";
import { 
  Compass, 
  MapPin, 
  Leaf, 
  ShieldAlert, 
  Truck, 
  TrendingUp, 
  ArrowRight,
  Settings,
  Scale,
  Award,
  Link,
  ChevronRight,
  Coins,
  FileCheck
} from "lucide-react";
import { MapConcession } from "./Map";

interface OpportunityRadarProps {
  concessions: MapConcession[];
  selectedConcessionId: string | null;
  onSelectConcession: (concession: MapConcession) => void;
}

export default function OpportunityRadar({
  concessions,
  selectedConcessionId,
  onSelectConcession
}: OpportunityRadarProps) {
  // Get opportunity concessions (where isOpportunity is true)
  const opportunities = concessions.filter(c => c.isOpportunity);

  // Set initially selected opportunity
  const [selectedOpp, setSelectedOpp] = useState<MapConcession>(
    opportunities.find(c => c.id === selectedConcessionId) || opportunities[0]
  );

  // Sync state if selectedConcessionId changes from outer context
  useEffect(() => {
    if (selectedConcessionId) {
      const match = opportunities.find(c => c.id === selectedConcessionId);
      if (match) {
        setSelectedOpp(match);
      }
    }
  }, [selectedConcessionId, opportunities]);

  // Factors state for score recalculation (PRD 7.2)
  const [factors, setFactors] = useState({
    geologicalPotential: 80, // percentage 0 to 100
    negotiability: 70,
    environmentalSafety: 90,
    socialSafety: 85,
    logistics: 75,
    nearbyActivity: 80,
    infrastructure: 60,
  });

  // Sync factor values with selected opportunity
  useEffect(() => {
    if (selectedOpp) {
      if (selectedOpp.id === "opp-1") {
        setFactors({
          geologicalPotential: 90,
          negotiability: 95, // Available for free claim
          environmentalSafety: 85, // Outside ANP
          socialSafety: 70,
          logistics: 80, // Near highway
          nearbyActivity: 95, // Near active formal mining
          infrastructure: 75,
        });
      } else if (selectedOpp.id === "opp-2") {
        setFactors({
          geologicalPotential: 80,
          negotiability: 60, // Joint Venture negotiations needed
          environmentalSafety: 95, // Deep safe zone
          socialSafety: 80,
          logistics: 65,
          nearbyActivity: 70,
          infrastructure: 55,
        });
      }
    }
  }, [selectedOpp]);

  // Calculate dynamic Legal Opportunity Score (PRD 7.2)
  const calculateDynamicScore = () => {
    const score = 
      (factors.geologicalPotential * 0.25) +
      (factors.negotiability * 0.20) +
      (factors.environmentalSafety * 0.20) +
      (factors.socialSafety * 0.15) +
      (factors.logistics * 0.10) +
      (factors.nearbyActivity * 0.05) +
      (factors.infrastructure * 0.05);
    return Math.round(score);
  };

  const dynamicScore = calculateDynamicScore();

  // Factors layout helpers
  const factorLabels = [
    { key: "geologicalPotential", label: "Potencial Geológico", weight: "25%", desc: "Presencia de mineralización o anomalías favorables." },
    { key: "negotiability", label: "Disponibilidad / Negociabilidad", weight: "20%", desc: "Derecho extinguido (libre petición) o socio/titular abierto a JV." },
    { key: "environmentalSafety", label: "Seguridad Ambiental", weight: "20%", desc: "Fuera de ANP, zonas de amortiguamiento y bosques primarios." },
    { key: "socialSafety", label: "Seguridad Social (Comunidades)", weight: "15%", desc: "Sin superposiciones con comunidades nativas o conflictos activos." },
    { key: "logistics", label: "Acceso Logístico", weight: "10%", desc: "Cercanía a vías de transporte terrestre principal o energía." },
    { key: "nearbyActivity", label: "Cercanía a Actividad Conocida", weight: "5%", desc: "Proximidad a faenas mineras o exploraciones con resultados." },
    { key: "infrastructure", label: "Infraestructura Cercana", weight: "5%", desc: "Presencia de campamentos, agua y servicios de soporte." },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
      
      {/* Column Left: Opportunities Directory (4/12 width) */}
      <div className="lg:col-span-4 glass-panel p-4 flex flex-col h-full overflow-hidden space-y-4">
        <div>
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Compass className="h-5 w-5 text-emerald-400" />
            Oportunidades de Inversión
          </h3>
          <p className="text-xs text-gray-400">Zonas de bajo riesgo socioambiental identificadas</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {opportunities.map((opp) => {
            const isSelected = selectedOpp.id === opp.id;
            
            return (
              <div
                key={opp.id}
                onClick={() => {
                  setSelectedOpp(opp);
                  onSelectConcession(opp);
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected 
                    ? "bg-emerald-600/15 border-emerald-500 shadow-md shadow-emerald-500/5 text-white" 
                    : "bg-white/5 border-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{opp.name}</h4>
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                      {opp.id === "opp-1" ? "Petitorio Directo" : "Joint Venture Comercial"}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {opp.opportunityScore}%
                  </span>
                </div>
                
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">{opp.description}</p>
                
                <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-white/5 pt-2">
                  <span>Área: {opp.area} Ha</span>
                  <span className="flex items-center gap-1 font-medium text-emerald-500">
                    Ver en mapa <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Column Center & Right: Opportunity Details & Score Recalculator (8/12 width) */}
      <div className="lg:col-span-8 flex flex-col h-full overflow-y-auto space-y-6 pr-2 pb-6">
        
        {/* Header Summary */}
        <div className="flex justify-between items-start gap-4 flex-wrap bg-white/5 border border-white/5 rounded-xl p-5">
          <div className="space-y-1">
            <span className="text-xs bg-emerald-600/20 text-emerald-400 font-semibold px-2.5 py-0.5 rounded border border-emerald-500/30">
              Oportunidad Viable Detectada
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">{selectedOpp.name}</h2>
            <div className="text-xs text-gray-400 flex flex-wrap gap-4">
              <span><strong>Ubicación:</strong> Inambari, Madre de Dios</span>
              <span><strong>Área Evaluada:</strong> {selectedOpp.area} Ha</span>
              <span><strong>Sustancia:</strong> Metálica (Oro aluvial / veta)</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-gray-400 font-semibold block uppercase">Opportunity Score</span>
            <span className="text-3xl font-extrabold text-emerald-400">{dynamicScore}%</span>
          </div>
        </div>

        {/* Dynamic Calculator Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Slider Factors */}
          <div className="glass-panel p-5 space-y-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-400" />
                Variables de Ponderación (PRD 7.2)
              </h3>
              <p className="text-xs text-gray-400">Ajusta las valoraciones para recalcular la viabilidad legal</p>
            </div>

            <div className="space-y-3">
              {factorLabels.map((factor) => (
                <div key={factor.key} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-200">{factor.label} ({factor.weight})</span>
                    <span className="text-emerald-400 font-bold">{factors[factor.key as keyof typeof factors]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={factors[factor.key as keyof typeof factors]}
                    onChange={(e) => setFactors({
                      ...factors,
                      [factor.key]: parseInt(e.target.value)
                    })}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[9px] text-gray-500 block leading-tight">{factor.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Viable Legal Routes (PRD 5.5) */}
          <div className="glass-panel p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Scale className="h-4 w-4 text-blue-400" />
                  Ruta Legal de Acceso Recomendada
                </h3>
                <p className="text-xs text-gray-400">Pasos formales para consolidar la operación</p>
              </div>

              {selectedOpp.id === "opp-1" ? (
                // Route for Sector Inambari Libre (Petitorio Directo)
                <div className="space-y-3">
                  <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl space-y-1.5">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <Award className="h-4 w-4" /> Paso 1: Petitorio de Concesión Directa
                    </span>
                    <p className="text-[11px] text-gray-300 leading-normal">
                      Dado que la zona figura en el catastro de INGEMMET como <strong>Libre de Derechos</strong> (anteriormente extinguida y no renovada), la ruta legal óptima es formular un petitorio directo por mesa de partes virtual.
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                    <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <Leaf className="h-3.5 w-3.5 text-emerald-400" /> Paso 2: Certificación Ambiental (IGA)
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Formular Declaración de Impacto Ambiental (DIA). La zona se encuentra fuera de ANP, lo que acelera el trámite a menos de 4 meses.
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                    <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-yellow-500" /> Paso 3: Autorización de Inicio de Actividad
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Acreditación de propiedad superficial o acuerdo con terceros y obtención de autorización de uso de agua (ALA).
                    </p>
                  </div>
                </div>
              ) : (
                // Route for Concesión Compra Verde (Joint Venture / Transferencia)
                <div className="space-y-3">
                  <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl space-y-1.5">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <Link className="h-4 w-4" /> Paso 1: Due Diligence Legal y Contractual
                    </span>
                    <p className="text-[11px] text-gray-300 leading-normal">
                      La concesión está titulada a nombre de un tercero. Se recomienda realizar una auditoría de deudas y vigencia en SIDEMCAT antes de formular una oferta comercial.
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                    <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-yellow-500" /> Paso 2: Contrato de Cesión Minera / Joint Venture
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Suscripción de contrato de cesión minera inscrito en SUNARP. Permite operar el derecho pagando regalías o porcentaje de producción.
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                    <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <FileCheck className="h-3.5 w-3.5 text-emerald-400" /> Paso 3: Modificación del IGA existente
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Heredar el instrumento ambiental del titular original o formular una modificación técnica simplificada para iniciar operaciones.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition mt-4">
              <span>Iniciar Carpeta de Evaluación Técnico-Legal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
