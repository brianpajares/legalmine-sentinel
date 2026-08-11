"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, ExternalLink, HardDriveDownload, Loader2 } from "lucide-react";

/**
 * Storage badge.
 *
 * The customer never has to open dev tools to know where their evaluations are
 * being kept. When Drive is wired up correctly the badge is green and links to
 * the folder in their account; when it is not, it says so plainly. The point is
 * that nothing about persistence is a surprise: if a screening is running
 * against an in-memory store, the badge says the state will not survive a
 * restart before an investor demo goes off the rails.
 */

interface DriveProbe {
  configured: boolean;
  ok: boolean;
  folder: { name: string; webViewLink: string } | null;
  dossiersFolder: { webViewLink: string } | null;
  error: string | null;
}

export default function StorageBadge() {
  const [probe, setProbe] = useState<DriveProbe | "loading" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    fetch("/api/health/drive", { cache: "no-store" })
      .then((response) => response.json().then((json) => ({ status: response.status, json })))
      .then(({ json }) => {
        if (mounted) setProbe(json as DriveProbe);
      })
      .catch(() => {
        if (mounted) setProbe("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (probe === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verificando almacenamiento…
      </div>
    );
  }

  if (probe === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-400">
        <CloudOff className="h-3 w-3" />
        Almacenamiento no confirmado
      </div>
    );
  }

  if (!probe.configured) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-100"
        title="Configura las variables GOOGLE_DRIVE_* para archivar las evaluaciones."
      >
        <CloudOff className="h-3 w-3" />
        Memoria efímera — se pierde al reiniciar
      </div>
    );
  }

  if (!probe.ok) {
    return (
      <div
        className="flex max-w-md items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-100"
        title={probe.error ?? undefined}
      >
        <CloudOff className="h-3 w-3 flex-none" />
        <span className="truncate">Drive configurado pero no responde</span>
      </div>
    );
  }

  return (
    <a
      href={probe.folder?.webViewLink ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/15"
      title={`Carpeta "${probe.folder?.name ?? "LegalMine data"}" en tu Google Drive`}
    >
      <CheckCircle2 className="h-3 w-3 flex-none" />
      Guardando en tu Google Drive
      <HardDriveDownload className="h-3 w-3 flex-none opacity-60" />
      <ExternalLink className="h-3 w-3 flex-none opacity-0 transition group-hover:opacity-70" />
    </a>
  );
}
