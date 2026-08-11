"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Printer, Table2 } from "lucide-react";

import { track } from "@/lib/analytics/client";

interface SavedFile {
  fileId: string;
  webViewLink: string;
  fileName: string;
}

interface ReportResponse {
  recorded: boolean;
  storage?: "memory" | "supabase" | "drive";
  dossier?: SavedFile | null;
  workbook?: SavedFile | null;
  dossierError?: string | null;
}

/**
 * Print & save.
 *
 * Two things happen at once: the browser opens its print dialog for a local PDF,
 * and the server archives a self-contained HTML copy to the customer's
 * account. Presenting them together — one visible on paper, one visible in
 * Drive — is what makes the dossier feel like a filed record, not a printout.
 */
export default function PrintButton({ assessmentId }: { assessmentId: string }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ link: string; name: string } | null>(null);
  const [workbook, setWorkbook] = useState<{ link: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    track("report_generated", { assessment_id: assessmentId });
    setSaving(true);
    setError(null);

    // Kick off the print dialog straight away; the server call runs in
    // parallel so the customer never waits on the network to see their PDF.
    window.print();

    try {
      const response = await fetch(`/api/assessments/${assessmentId}/report`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as ReportResponse | null;
      if (payload?.dossier) {
        setSaved({ link: payload.dossier.webViewLink, name: payload.dossier.fileName });
        track("report_saved_to_drive", { assessment_id: assessmentId });
      }
      if (payload?.workbook) {
        setWorkbook({ link: payload.workbook.webViewLink, name: payload.workbook.fileName });
      }
      if (!payload?.dossier && payload?.dossierError) {
        setError(payload.dossierError);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not confirm the Drive upload.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-progress disabled:opacity-70"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        {saving ? "Guardando en Drive…" : "Imprimir / guardar como PDF"}
      </button>

      {saved ? (
        <a
          href={saved.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-[240px] items-center gap-1.5 truncate rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-500/15 print:hidden"
          title={`Abrir "${saved.name}" en Google Drive`}
        >
          <CheckCircle2 className="h-3 w-3 flex-none" />
          <span className="truncate">Dossier guardado en tu Drive</span>
          <ExternalLink className="h-3 w-3 flex-none" />
        </a>
      ) : null}

      {workbook ? (
        <a
          href={workbook.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-[240px] items-center gap-1.5 truncate rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-500/15 print:hidden"
          title={`Abrir "${workbook.name}" — datos en hoja de cálculo`}
        >
          <Table2 className="h-3 w-3 flex-none" />
          <span className="truncate">Datos en Excel</span>
          <ExternalLink className="h-3 w-3 flex-none" />
        </a>
      ) : null}

      {error ? (
        <p className="max-w-[240px] text-right text-[10px] text-amber-300/80 print:hidden">
          Impresión completa. La copia a Drive falló: {error}
        </p>
      ) : null}
    </div>
  );
}
