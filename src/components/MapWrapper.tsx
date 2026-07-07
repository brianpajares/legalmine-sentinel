"use client";

import dynamic from "next/dynamic";
import { MapConcession } from "./Map";

// Dynamically import the Map component with SSR disabled
const DynamicMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-xl border border-white/10 bg-slate-950/80 flex flex-col items-center justify-center text-gray-400 gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      <p className="font-medium animate-pulse">Cargando Visor GIS GeoAI...</p>
    </div>
  ),
});

interface MapWrapperProps {
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

export default function MapWrapper(props: MapWrapperProps) {
  return <DynamicMap {...props} />;
}
