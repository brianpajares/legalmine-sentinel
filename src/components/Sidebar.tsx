"use client";

import { 
  ShieldAlert, 
  Map, 
  LayoutDashboard, 
  Compass, 
  FileText, 
  Settings as SettingsIcon,
  LogOut,
  UserCheck
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  alertCount: number;
  opportunityCount: number;
}

export default function Sidebar({ activeTab, setActiveTab, alertCount, opportunityCount }: SidebarProps) {
  const menuItems = [
    {
      id: "overview",
      label: "Panel General",
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: "map",
      label: "Visor GIS",
      icon: Map,
      badge: null
    },
    {
      id: "alerts",
      label: "Alertas de Riesgo",
      icon: ShieldAlert,
      badge: alertCount > 0 ? alertCount : null,
      badgeColor: "bg-red-500/20 text-red-400 border border-red-500/30"
    },
    {
      id: "radar",
      label: "Radar Legal",
      icon: Compass,
      badge: opportunityCount > 0 ? opportunityCount : null,
      badgeColor: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
    },
    {
      id: "dossier",
      label: "Expedientes B2B",
      icon: FileText,
      badge: null
    },
    {
      id: "settings",
      label: "Configuración",
      icon: SettingsIcon,
      badge: null
    }
  ];

  return (
    <aside className="w-64 border-r border-white/10 bg-[#0b0f19]/90 backdrop-blur-md flex flex-col h-full shrink-0 z-30">
      {/* Header Logo */}
      <div className="p-6 border-b border-white/10 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <ShieldAlert className="h-6 w-6 text-white floating-icon" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wider uppercase leading-none">LegalMine</h1>
          <span className="text-[10px] font-semibold text-blue-400 tracking-widest uppercase">Sentinel</span>
        </div>
      </div>

      {/* User Session Profile Card */}
      <div className="p-4 mx-4 mt-6 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-blue-900/60 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-sm">
          BP
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-semibold text-gray-200 truncate">Brian Pajares</p>
          <div className="flex items-center gap-1">
            <UserCheck className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] text-gray-400 font-medium">Analista Premium</span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-600/20 text-blue-400 border-l-4 border-blue-500 shadow-md shadow-blue-500/5"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? "text-blue-400 animate-pulse" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / System status */}
      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="text-[10px] text-gray-500 flex justify-between items-center">
          <span>Servicio GeoAI:</span>
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Conectado
          </span>
        </div>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
          <LogOut className="h-3.5 w-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
