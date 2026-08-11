"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Assessment, Project } from "@/types/assessment";
import Dossier from "./Dossier";

interface CachedReport {
  assessment: Assessment;
  project: Project | null;
  savedAt: string;
}

const keyFor = (assessmentId: string) => `legalmine:report:${assessmentId}`;

export function saveReportFallback(assessment: Assessment, project: Project | null) {
  if (typeof window === "undefined") return;
  const payload: CachedReport = { assessment, project, savedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(keyFor(assessment.id), JSON.stringify(payload));
  } catch {
    // The server store remains the source of truth. Local fallback is best effort.
  }
}

export default function ClientReportFallback({ assessmentId }: { assessmentId: string }) {
  const [cached, setCached] = useState<CachedReport | null | undefined>(undefined);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(keyFor(assessmentId));
        if (!raw) {
          setCached(null);
          return;
        }
        const parsed = JSON.parse(raw) as CachedReport;
        if (parsed.assessment?.id === assessmentId) {
          setCached(parsed);
        } else {
          setCached(null);
        }
      } catch {
        setCached(null);
      }
    });
  }, [assessmentId]);

  if (cached === undefined) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 text-center">
        <h1 className="text-lg font-bold text-white">Recuperando dossier...</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          Buscando una copia local del analisis generado en este navegador.
        </p>
      </main>
    );
  }

  if (cached) {
    return <Dossier assessment={cached.assessment} project={cached.project} />;
  }

  return <Unavailable assessmentId={assessmentId} />;
}

/**
 * Explains *why* the dossier is gone, not just that it is.
 *
 * A dossier disappears for one of two reasons, and they call for different
 * actions. Either the deployment is on the in-memory store — a serverless
 * instance recycled and every past assessment went with it, until Drive is
 * configured — or durable storage is healthy and this particular id was never
 * written. Making the operator guess between them wastes their time, so the
 * page asks the health endpoint and names the cause.
 */
function Unavailable({ assessmentId }: { assessmentId: string }) {
  const [storage, setStorage] = useState<"unknown" | "ephemeral" | "durable">("unknown");

  useEffect(() => {
    let mounted = true;
    fetch("/api/health/drive", { cache: "no-store" })
      .then((response) => response.json())
      .then((json: { configured?: boolean; ok?: boolean }) => {
        if (mounted) setStorage(json.configured && json.ok ? "durable" : "ephemeral");
      })
      .catch(() => {
        if (mounted) setStorage("unknown");
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
      <h1 className="text-lg font-bold text-white">Este dossier no está disponible</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        No se encontró el análisis <span className="font-mono text-xs">{assessmentId}</span> ni en el
        servidor ni en la copia local de este navegador.
      </p>

      {storage === "ephemeral" ? (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-200">
            Causa: almacenamiento efímero
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-amber-100/90">
            Este despliegue está guardando en memoria del proceso. En Vercel cada petición puede
            caer en una instancia distinta, así que un análisis hecho hace un momento desaparece en
            cuanto esa instancia se recicla.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-amber-100/90">
            <strong className="font-semibold">Cómo se resuelve:</strong> configura{" "}
            <span className="font-mono text-[11px]">GOOGLE_DRIVE_CLIENT_ID</span>,{" "}
            <span className="font-mono text-[11px]">GOOGLE_DRIVE_CLIENT_SECRET</span> y{" "}
            <span className="font-mono text-[11px]">GOOGLE_DRIVE_REFRESH_TOKEN</span> en el entorno
            de producción. Desde ahí cada análisis y su dossier quedan archivados en tu Drive.
          </p>
        </div>
      ) : storage === "durable" ? (
        <div className="mt-5 rounded-xl border border-white/15 bg-white/[0.04] p-4 text-left">
          <p className="text-[12px] leading-relaxed text-gray-300">
            El almacenamiento durable está activo, así que este identificador nunca llegó a
            escribirse — probablemente el análisis corrió antes de configurarlo. Vuelve a ejecutar el
            tamizaje y quedará archivado.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app"
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          Ejecutar nuevo análisis
        </Link>
        <a
          href="/api/health/drive"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
        >
          Ver diagnóstico de almacenamiento
        </a>
      </div>
    </main>
  );
}
