"use client";

import dynamic from "next/dynamic";

import type { Evidence } from "@/types/evidence";
import type { GeoGeometry, Position } from "@/types/geo";

/**
 * Leaflet touches `window` during module evaluation, so the map is loaded on the
 * client only. Everything else in the workspace renders on the server.
 */
const AssessmentMap = dynamic(() => import("./AssessmentMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
      <p className="text-xs text-gray-500">Loading map…</p>
    </div>
  ),
});

export default function MapPanel(props: {
  aoi: GeoGeometry;
  evidence: Evidence[];
  center: Position;
  onSelectEvidence?: (evidence: Evidence) => void;
}) {
  return <AssessmentMap {...props} />;
}
