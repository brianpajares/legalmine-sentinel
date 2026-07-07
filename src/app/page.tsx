"use client";

import dynamic from "next/dynamic";

// Dynamically import the main Dashboard with SSR disabled 
// to prevent Leaflet window reference errors during builds.
const DynamicDashboard = dynamic(() => import("@/components/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen w-screen bg-[#070a13] flex flex-col items-center justify-center text-gray-400 gap-3">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <p className="font-medium tracking-wider animate-pulse">Iniciando Consola de Inteligencia GeoAI...</p>
    </div>
  ),
});

export default function Home() {
  return <DynamicDashboard />;
}
