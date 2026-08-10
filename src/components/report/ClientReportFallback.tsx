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

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 text-center">
      <h1 className="text-lg font-bold text-white">Este dossier no esta disponible</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-400">
        No se encontro el analisis <span className="font-mono text-xs">{assessmentId}</span> en el
        almacenamiento del servidor ni en la copia local de este navegador. Ejecuta nuevamente el
        tamizaje; desde ahora el dossier queda protegido con respaldo local inmediato.
      </p>
      <Link
        href="/app"
        className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
      >
        Ejecutar nuevo analisis
      </Link>
    </main>
  );
}
