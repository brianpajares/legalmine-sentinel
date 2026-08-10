"use client";

import { Printer } from "lucide-react";

import { track } from "@/lib/analytics/client";

export default function PrintButton({ assessmentId }: { assessmentId: string }) {
  async function handleClick() {
    track("report_generated", { assessment_id: assessmentId });
    // Recorded server-side too, so the "dossiers generated" metric survives an
    // analytics outage and reflects real usage rather than page views.
    void fetch(`/api/assessments/${assessmentId}/report`, { method: "POST" }).catch(() => {});
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
    >
      <Printer className="h-3.5 w-3.5" />
      Print / save as PDF
    </button>
  );
}
