"use client";

import { 
  ShieldAlert, 
  MapPin, 
  TrendingUp, 
  Compass, 
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Layers,
  Leaf
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { MapConcession } from "./Map";

interface OverviewProps {
  concessions: MapConcession[];
  onNavigateToTab: (tab: string, selectedConcessionId?: string) => void;
}

export default function Overview({ concessions, onNavigateToTab }: OverviewProps) {
  // Extract stats
  const totalMonitored = concessions.filter(c => !c.isOpportunity).length;
  const activeAlerts = concessions.filter(c => !c.isOpportunity && c.riskScore >= 40);
  const criticalCount = activeAlerts.filter(c => c.riskScore >= 80).length;
  const highCount = activeAlerts.filter(c => c.riskScore >= 60 && c.riskScore < 80).length;
  const opportunitiesCount = concessions.filter(c => c.isOpportunity).length;

  const averageRisk = Math.round(
    concessions.filter(c => !c.isOpportunity).reduce((sum, curr) => sum + curr.riskScore, 0) / totalMonitored
  );

  // Recharts simulated data
  // 1. Deforestation Trend (Hectares lost over last 6 months in Madre de Dios buffer zone)
  const deforestationData = [
    { month: "Ene", ha: 12.5, alertas: 8 },
    { month: "Feb", ha: 15.2, alertas: 12 },
    { month: "Mar", ha: 9.8, alertas: 7 },
    { month: "Abr", ha: 24.1, alertas: 19 },
    { month: "May", ha: 31.5, alertas: 26 },
    { month: "Jun", ha: 42.8, alertas: 35 },
  ];

  // 2. Risk distribution data
  const riskCategoriesData = [
    { name: "Crítico (80-100)", value: criticalCount, color: "#ef4444" },
    { name: "Alto (60-79)", value: highCount, color: "#f59e0b" },
    { name: "Medio (40-59)", value: activeAlerts.filter(c => c.riskScore >= 40 && c.riskScore < 60).length, color: "#eab308" },
    { name: "Bajo (0-39)", value: concessions.filter(c => !c.isOpportunity && c.riskScore < 40).length, color: "#10b981" },
  ];

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-2">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Panel de Inteligencia General</h2>
        <p className="text-sm text-gray-400">Resumen y estado de monitoreo de derechos mineros con GeoAI</p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Total Monitored */}
        <div className="glass-panel p-5 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Concesiones Monitoreadas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{totalMonitored}</span>
              <span className="text-[10px] text-gray-400">Catastro B2B</span>
            </div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
            <Layers className="h-6 w-6" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
        </div>

        {/* Card 2: Active Alerts */}
        <div className="glass-panel p-5 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alertas Activas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-red-500">{activeAlerts.length}</span>
              <span className="text-[10px] text-red-400 font-medium">({criticalCount} Críticas)</span>
            </div>
          </div>
          <div className={`p-3 rounded-lg text-red-400 border ${criticalCount > 0 ? "bg-red-500/10 border-red-500/20 critical-pulse" : "bg-yellow-500/10 border-yellow-500/20"}`}>
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-rose-600"></div>
        </div>

        {/* Card 3: Opportunities */}
        <div className="glass-panel p-5 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Oportunidades Legales</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400">{opportunitiesCount}</span>
              <span className="text-[10px] text-emerald-400">Radar Activo</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <Compass className="h-6 w-6" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        </div>

        {/* Card 4: Average Risk */}
        <div className="glass-panel p-5 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Riesgo Promedio Cartera</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-500">{averageRisk}%</span>
              <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3 text-red-400" />
                +2.4% este mes
              </span>
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-500"></div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Deforestation Area Trend */}
        <div className="glass-panel p-5 col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white">Evolución de Deforestación en Madre de Dios</h3>
              <p className="text-xs text-gray-400">Pérdida de bosque estimada en hectáreas (Ha) acumulada por mes</p>
            </div>
            <span className="flex items-center gap-1 text-red-400 text-xs font-medium bg-red-950/40 border border-red-500/20 px-2.5 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" />
              Tendencia al alza
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deforestationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#4b5563" fontSize={11} />
                <YAxis stroke="#4b5563" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: 8 }}
                  labelStyle={{ color: "#ffffff", fontWeight: "bold", fontSize: 12 }}
                  itemStyle={{ color: "#ef4444", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="ha" name="Hectáreas" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorHa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution Breakdown */}
        <div className="glass-panel p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Nivel de Riesgo en Cartera</h3>
            <p className="text-xs text-gray-400">Distribución de derechos según Mining Risk Score</p>
          </div>
          
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskCategoriesData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#4b5563" fontSize={9} tickLine={false} />
                <YAxis stroke="#4b5563" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: 8 }}
                  itemStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="value" name="Concesiones" radius={[4, 4, 0, 0]}>
                  {riskCategoriesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center border-b border-white/5 pb-1">
              <span className="text-red-400 font-medium">🚨 Crítico (80-100)</span>
              <span className="font-bold text-white">{criticalCount}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-1">
              <span className="text-amber-500 font-medium">⚠️ Alto (60-79)</span>
              <span className="font-bold text-white">{highCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-emerald-400 font-medium font-medium">✅ Bajo/Seguro (0-39)</span>
              <span className="font-bold text-white">{concessions.filter(c => !c.isOpportunity && c.riskScore < 40).length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Alerts and Opportunities grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Critical Alerts List */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
              Alertas Críticas Recientes
            </h3>
            <button 
              onClick={() => onNavigateToTab("alerts")} 
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition"
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-3">
            {activeAlerts.slice(0, 3).map((concession) => (
              <div 
                key={concession.id} 
                className="p-3 bg-white/5 border border-white/5 hover:border-red-500/30 hover:bg-white/10 rounded-xl flex justify-between items-center transition cursor-pointer"
                onClick={() => onNavigateToTab("alerts", concession.id)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-200">{concession.name}</span>
                    <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-semibold">{concession.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Madre de Dios
                    </span>
                    <span>Código: {concession.code}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-gray-400 font-medium">Riesgo</span>
                  <span className="font-extrabold text-sm text-red-500 bg-red-950/40 px-2.5 py-0.5 rounded-full border border-red-500/30">
                    {concession.riskScore}%
                  </span>
                </div>
              </div>
            ))}
            {activeAlerts.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No se registran alertas de riesgo en este periodo.</p>
            )}
          </div>
        </div>

        {/* Opportunities List */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="h-5 w-5 text-emerald-400" />
              Oportunidades de Minería Legal
            </h3>
            <button 
              onClick={() => onNavigateToTab("radar")} 
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition"
            >
              Ir al Radar <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-3">
            {concessions.filter(c => c.isOpportunity).slice(0, 3).map((opp) => (
              <div 
                key={opp.id} 
                className="p-3 bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-white/10 rounded-xl flex justify-between items-center transition cursor-pointer"
                onClick={() => onNavigateToTab("radar", opp.id)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-200">{opp.name}</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">Petitorio Viable</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Leaf className="h-3.5 w-3.5 text-emerald-500" />
                      Fuera de ANP (Riesgo Bajo)
                    </span>
                    <span>Sustancia: Metálica</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-gray-400 font-medium">Score</span>
                  <span className="font-extrabold text-sm text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    {opp.opportunityScore}%
                  </span>
                </div>
              </div>
            ))}
            {concessions.filter(c => c.isOpportunity).length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No se han identificado nuevas oportunidades.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
