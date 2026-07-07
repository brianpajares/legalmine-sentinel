"use client";

import { useState } from "react";
import { 
  FileText, 
  Download, 
  Printer, 
  ShieldAlert, 
  CheckCircle,
  FileCheck,
  Calendar,
  Layers,
  Activity,
  UserCheck
} from "lucide-react";
import { MapConcession } from "./Map";

interface DossierExporterProps {
  concessions: MapConcession[];
}

export default function DossierExporter({ concessions }: DossierExporterProps) {
  const alertsList = concessions.filter(c => !c.isOpportunity);
  const [selectedConcession, setSelectedConcession] = useState<MapConcession>(alertsList[0]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
      
      {/* Selector Sidebar (3/12 width) */}
      <div className="lg:col-span-3 glass-panel p-4 flex flex-col h-full overflow-hidden space-y-4 print:hidden">
        <div>
          <h3 className="font-bold text-base text-white">Generador de Expedientes</h3>
          <p className="text-xs text-gray-400">Selecciona el derecho para compilar la evidencia</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {alertsList.map((c) => {
            const isSelected = selectedConcession.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedConcession(c)}
                className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-semibold ${
                  isSelected 
                    ? "bg-blue-600/15 border-blue-500 text-blue-400" 
                    : "bg-white/5 border-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="truncate max-w-[120px]">{c.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    c.riskScore >= 80 ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                  }`}>
                    Score: {c.riskScore}%
                  </span>
                </div>
                <span className="text-[10px] text-gray-500">Cód: {c.code}</span>
              </button>
            );
          })}
        </div>

        <button 
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition"
        >
          <Printer className="h-4 w-4" />
          <span>Imprimir Expediente Técnico</span>
        </button>
      </div>

      {/* Dossier Sheet Preview (9/12 width) */}
      <div className="lg:col-span-9 flex flex-col h-full overflow-y-auto pr-2 pb-6 print:absolute print:inset-0 print:bg-white print:text-black print:p-8 print:w-full print:h-auto">
        
        {/* Printable Paper Canvas */}
        <div className="bg-[#111827] border border-white/10 rounded-xl p-8 shadow-2xl space-y-6 print:border-none print:shadow-none print:bg-white print:text-black print:p-0">
          
          {/* Dossier Header */}
          <div className="flex justify-between items-start border-b border-white/10 pb-6 print:border-black/20">
            <div className="space-y-1">
              <span className="text-[10px] bg-blue-600/10 text-blue-400 px-2.5 py-1 rounded border border-blue-500/20 font-bold uppercase tracking-wider print:border-black print:text-black">
                GeoAI Intelligence Platform
              </span>
              <h2 className="text-2xl font-bold text-white print:text-black tracking-tight uppercase mt-1.5">
                Expediente de Evidencia Satelital
              </h2>
              <p className="text-xs text-gray-400 print:text-black/60">
                LegalMine Sentinel &bull; Sistema de Compliance y Alertas Tempranas
              </p>
            </div>
            
            <div className="text-right space-y-1">
              <span className="text-xs text-gray-400 print:text-black/50 block font-semibold">CÓDIGO DE REPORTE</span>
              <span className="text-sm font-extrabold text-blue-400 print:text-black bg-blue-950/40 print:bg-black/5 px-2.5 py-1 rounded border border-blue-500/10 print:border-black/20">
                REP-2026-LMS-{selectedConcession.code}
              </span>
            </div>
          </div>

          {/* Target Concession Data Sheet */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white print:text-black border-l-4 border-blue-500 pl-2 uppercase tracking-wide">
              1. Identificación del Derecho Minero
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg print:border-black/20 print:bg-transparent">
                <span className="text-gray-400 print:text-black/60 block font-medium">Nombre Derecho:</span>
                <span className="text-white print:text-black font-bold text-sm">{selectedConcession.name}</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg print:border-black/20 print:bg-transparent">
                <span className="text-gray-400 print:text-black/60 block font-medium">Código Catastral:</span>
                <span className="text-white print:text-black font-bold text-sm">{selectedConcession.code}</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg print:border-black/20 print:bg-transparent">
                <span className="text-gray-400 print:text-black/60 block font-medium">Titular Inscrito:</span>
                <span className="text-white print:text-black font-bold text-sm truncate block">{selectedConcession.owner}</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg print:border-black/20 print:bg-transparent">
                <span className="text-gray-400 print:text-black/60 block font-medium">Estado Catastral:</span>
                <span className="text-white print:text-black font-bold text-sm">{selectedConcession.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg print:border-black/20 print:bg-transparent">
                <span className="text-gray-400 print:text-black/60 block font-medium">Sustancia:</span>
                <span className="text-white print:text-black font-bold">{selectedConcession.substance}</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg print:border-black/20 print:bg-transparent">
                <span className="text-gray-400 print:text-black/60 block font-medium">Superficie Total:</span>
                <span className="text-white print:text-black font-bold">{selectedConcession.area} Hectáreas</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg print:border-black/20 print:bg-transparent col-span-2">
                <span className="text-gray-400 print:text-black/60 block font-medium">Ubicación Política:</span>
                <span className="text-white print:text-black font-bold">Distrito de Inambari, Tambopata, Madre de Dios</span>
              </div>
            </div>
          </div>

          {/* GeoAI Indicators & Mining Risk Score */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white print:text-black border-l-4 border-blue-500 pl-2 uppercase tracking-wide">
              2. Análisis de Detección GeoAI e Indicadores de Riesgo
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              
              {/* Score Display Ring */}
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl flex flex-col items-center justify-center text-center print:border-black/20 print:bg-transparent">
                <span className="text-[10px] text-gray-400 print:text-black/60 font-semibold uppercase tracking-wider block mb-2">Mining Risk Score</span>
                <div className={`h-24 w-24 rounded-full border-4 flex flex-col items-center justify-center ${
                  selectedConcession.riskScore >= 80 
                    ? "border-red-500 text-red-500 shadow-md shadow-red-500/10" 
                    : "border-amber-500 text-amber-500 shadow-md shadow-amber-500/10"
                }`}>
                  <span className="text-3xl font-extrabold">{selectedConcession.riskScore}%</span>
                </div>
                <span className="text-xs font-bold mt-3 uppercase tracking-wide">
                  {selectedConcession.riskScore >= 80 ? "Nivel de Alerta: Crítico" : "Nivel de Alerta: Alto"}
                </span>
              </div>

              {/* Observed Indicators list */}
              <div className="md:col-span-2 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-white/5 pb-1 print:border-black/10">
                  <span className="text-gray-400 print:text-black/70 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-red-500 shrink-0" />
                    Pérdida de vegetación boscosa reciente (deforestación)
                  </span>
                  <span className="font-semibold text-white print:text-black">Observado (20%)</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-1 print:border-black/10">
                  <span className="text-gray-400 print:text-black/70 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-red-500 shrink-0" />
                    Pozas artificiales de lavado de oro aluvial
                  </span>
                  <span className="font-semibold text-white print:text-black">Observado (20%)</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-1 print:border-black/10">
                  <span className="text-gray-400 print:text-black/70 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-red-500 shrink-0" />
                    Cercanía inmediata a cuerpos de agua o ríos
                  </span>
                  <span className="font-semibold text-white print:text-black">Observado (10%)</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-1 print:border-black/10">
                  <span className="text-gray-400 print:text-black/70 flex items-center gap-2">
                    {selectedConcession.riskScore >= 80 ? (
                      <CheckCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-gray-500 shrink-0 block"></span>
                    )}
                    Ubicación en zona de amortiguamiento o interior de ANP
                  </span>
                  <span className="font-semibold text-white print:text-black">
                    {selectedConcession.riskScore >= 80 ? "Observado (15%)" : "No detectado (0%)"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 print:text-black/70 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-red-500 shrink-0" />
                    RUC titular sin inscripción formalizada vigente (REINFO)
                  </span>
                  <span className="font-semibold text-white print:text-black">Observado (10%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Compliance Status (REINFO) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white print:text-black border-l-4 border-blue-500 pl-2 uppercase tracking-wide">
              3. Cumplimiento Legal y Estatus REINFO
            </h3>

            <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-xs space-y-3 print:border-black/20 print:bg-transparent">
              <div className="flex justify-between items-center border-b border-white/5 pb-2 print:border-black/10">
                <span className="font-bold text-gray-300 print:text-black">DECLARANTE MINERO / RUC:</span>
                <span className="font-semibold text-white print:text-black">{selectedConcession.owner} (RUC: 10439281729)</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2 print:border-black/10">
                <span className="font-bold text-gray-300 print:text-black">ESTADO DE REGISTRO REINFO:</span>
                <span className={`font-extrabold px-2.5 py-0.5 rounded ${
                  selectedConcession.riskScore >= 85 
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 print:text-red-600 print:border-red-600" 
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30 print:text-amber-600 print:border-amber-600"
                }`}>
                  {selectedConcession.riskScore >= 85 ? "NO INSCRITO / SUSPENDIDO" : "INSCRIPCIÓN SUSPENDIDA"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-300 print:text-black">VINCULACIÓN CATASTRAL:</span>
                <span className="text-gray-400 print:text-black font-medium text-right max-w-sm">
                  El polígono de deforestación y pozas detectado cae en coordenadas superpuestas a la concesión {selectedConcession.name}.
                </span>
              </div>
            </div>
          </div>

          {/* Satellite Evidence Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white print:text-black border-l-4 border-blue-500 pl-2 uppercase tracking-wide">
              4. Evidencia Visual Satelital
            </h3>

            {/* Side by side visual layout */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-[#0b0f19] border border-white/10 rounded-xl overflow-hidden print:border-black/20">
                <div className="bg-emerald-950/30 p-2 border-b border-white/5 font-bold text-[10px] text-emerald-400 print:text-black print:bg-black/5">
                  ANTES: Julio 2024 (Sentinel-2 L2A)
                </div>
                <div className="aspect-[4/3] bg-emerald-900/10 flex items-center justify-center relative">
                  <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="#143c1a" />
                    <path d="M-10,40 Q80,120 180,60 T400,200" fill="none" stroke="#3b82f6" strokeWidth="18" />
                  </svg>
                  <span className="text-[10px] text-emerald-400 font-bold z-10 bg-black/40 px-2 py-0.5 rounded">Cobertura Bosque Completa</span>
                </div>
              </div>

              <div className="bg-[#0b0f19] border border-white/10 rounded-xl overflow-hidden print:border-black/20">
                <div className="bg-red-950/30 p-2 border-b border-white/5 font-bold text-[10px] text-red-400 print:text-black print:bg-black/5">
                  AHORA: Julio 2026 (Sentinel-2 L2A)
                </div>
                <div className="aspect-[4/3] bg-red-900/10 flex items-center justify-center relative">
                  <svg className="absolute inset-0 w-full h-full opacity-80" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="#1e2e18" />
                    <path d="M 80,120 Q 150,150 250,130 T 350,220" fill="none" stroke="#d4c5a1" strokeWidth="60" strokeLinecap="round" />
                    <path d="M-10,40 Q80,120 180,60 T400,200" fill="none" stroke="#b45309" strokeWidth="18" />
                    <ellipse cx="180" cy="140" rx="30" ry="15" fill="#a3e635" stroke="#e4e4e7" strokeWidth="2" />
                  </svg>
                  <span className="text-[10px] text-red-400 font-bold z-10 bg-black/40 px-2 py-0.5 rounded">Pérdida de Bosque y Pozas Activas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dossier Footer with disclaimer */}
          <div className="border-t border-white/10 pt-4 text-[10px] text-gray-500 space-y-2 print:border-black/20 print:text-black/60 leading-relaxed">
            <p>
              <strong>AVISO DE CARÁCTER RESERVADO Y REFERENCIAL:</strong> El presente expediente ha sido compilado automáticamente mediante algoritmos de inteligencia geoespacial (GeoAI) sobre imágenes del satélite Sentinel-2 de la Agencia Espacial Europea (ESA) y datos abiertos del Ministerio de Energía y Minas (MINEM) e INGEMMET de la República del Perú. LegalMine Sentinel no realiza diagnósticos delictivos finales; provee indicios técnicos y análisis espacial de alerta temprana para soporte legal y de auditoría ambiental (due diligence).
            </p>
            <div className="flex justify-between items-center text-[9px] font-semibold text-gray-400 print:text-black">
              <span>Acreditado por: Brian Pajares - Analista Premium</span>
              <span>Fecha de Compilación: {new Date().toLocaleDateString("es-ES")}</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
