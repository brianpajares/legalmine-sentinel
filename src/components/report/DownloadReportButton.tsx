"use client";

import { Download } from "lucide-react";

import { track } from "@/lib/analytics/client";

export default function DownloadReportButton({ assessmentId }: { assessmentId: string }) {
  function handleClick() {
    track("report_generated", { assessment_id: assessmentId, format: "html_download" });
    void fetch(`/api/assessments/${assessmentId}/report`, { method: "POST" }).catch(() => {});

    const html = "<!doctype html>\n" + document.documentElement.outerHTML;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `legalmine-due-diligence-${assessmentId}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
    >
      <Download className="h-3.5 w-3.5" />
      Descargar informe
    </button>
  );
}
