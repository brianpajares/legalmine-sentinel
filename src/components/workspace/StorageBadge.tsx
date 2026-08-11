"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, ExternalLink, HardDriveDownload, Loader2 } from "lucide-react";

import type { WorkspaceCopy } from "@/lib/i18n/workspace";

/**
 * Storage badge.
 *
 * The operator never has to open dev tools to know where their evaluations are
 * being kept. Green links to the folder in their own Drive; amber says plainly
 * that the state will not survive a restart. A screening running against
 * ephemeral storage announces itself before an investor demo goes off the rails
 * — which is exactly the failure this badge was added to catch.
 */

interface DriveProbe {
  configured: boolean;
  ok: boolean;
  folder: { name: string; webViewLink: string } | null;
  dossiersFolder: { webViewLink: string } | null;
  error: string | null;
}

export default function StorageBadge({ copy }: { copy: WorkspaceCopy }) {
  const [probe, setProbe] = useState<DriveProbe | "loading" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    fetch("/api/health/drive", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (mounted) setProbe(json as DriveProbe);
      })
      .catch(() => {
        if (mounted) setProbe("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const shell =
    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition";

  if (probe === "loading") {
    return (
      <div className={`${shell} border-white/10 bg-white/[0.03] text-gray-400`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {copy.storage.checking}
      </div>
    );
  }

  if (probe === "error") {
    return (
      <div className={`${shell} border-white/10 bg-white/[0.03] text-gray-400`}>
        <CloudOff className="h-3 w-3" />
        {copy.storage.unconfirmed}
      </div>
    );
  }

  if (!probe.configured) {
    return (
      <div
        className={`${shell} border-amber-400/40 bg-amber-500/10 text-amber-100`}
        title={copy.storage.ephemeralHint}
      >
        <CloudOff className="h-3 w-3 flex-none" />
        {copy.storage.ephemeral}
      </div>
    );
  }

  if (!probe.ok) {
    return (
      <div
        className={`${shell} max-w-md border-amber-400/40 bg-amber-500/10 text-amber-100`}
        title={probe.error ?? undefined}
      >
        <CloudOff className="h-3 w-3 flex-none" />
        <span className="truncate">{copy.storage.driveDown}</span>
      </div>
    );
  }

  return (
    <a
      href={probe.folder?.webViewLink ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`${shell} group border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15`}
      title={copy.storage.driveOkHint}
    >
      <CheckCircle2 className="h-3 w-3 flex-none" />
      {copy.storage.driveOk}
      <HardDriveDownload className="h-3 w-3 flex-none opacity-60" />
      <ExternalLink className="h-3 w-3 flex-none opacity-0 transition group-hover:opacity-70" />
    </a>
  );
}
