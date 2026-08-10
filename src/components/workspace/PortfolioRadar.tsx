"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Radar, TrendingUp } from "lucide-react";

import type { Assessment } from "@/types/assessment";
import { EmptyState, Meter, Panel, PanelHeader } from "@/components/ui/Primitives";
import { formatTimestamp, opportunityScore, RISK_STYLES, topFactors } from "@/lib/ui/format";

type Summary = Pick<
  Assessment,
  | "id"
  | "projectId"
  | "projectName"
  | "createdAt"
  | "status"
  | "overallRisk"
  | "riskLevel"
  | "confidence"
  | "confidenceLevel"
  | "ruleVersion"
  | "demoMode"
>;

/**
 * Opportunity Screening Radar (Plan Maestro §8).
 *
 * The radar is a commercial triage view, not a legal opinion: it highlights
 * assets that deserve more attention when low preliminary risk is supported by
 * enough data confidence, and it states what blocked a stronger conclusion.
 */
export default function PortfolioRadar({ currentAssessment }: { currentAssessment?: Assessment }) {
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/assessments")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { assessments: Summary[] }) => {
        if (active) setRows(data.assessments);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const ranked = useMemo(() => {
    const history = rows ?? [];
    const deduped = currentAssessment
      ? [currentAssessment, ...history.filter((row) => row.id !== currentAssessment.id)]
      : history;
    return deduped
      .map((row) => ({
        row,
        score: opportunityScore(row as Assessment),
        current: currentAssessment?.id === row.id,
      }))
      .sort((a, b) => b.score - a.score);
  }, [currentAssessment, rows]);

  return (
    <div className="space-y-5">
      {currentAssessment ? <CurrentRadar assessment={currentAssessment} /> : null}

      <Panel className="p-5">
        <PanelHeader
          title="Radar de oportunidades"
          subtitle="Ranking por bajo riesgo preliminar respaldado por confianza de datos. Un score alto significa que el activo merece una revision mas profunda, no que sea legalmente viable."
        />

        {failed ? (
          <p className="mt-4 text-xs text-gray-500">No se pudo cargar el historial de analisis.</p>
        ) : rows === null ? (
          <p className="mt-4 text-xs text-gray-500">Cargando...</p>
        ) : ranked.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Aun no hay analisis"
              detail="Ejecuta un tamizaje y aparecera aqui. Esta lista solo muestra analisis reales guardados en este despliegue."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-gray-500">
                <tr className="border-b border-white/10">
                  <th className="py-2 font-semibold">Activo</th>
                  <th className="py-2 font-semibold">Interes</th>
                  <th className="py-2 font-semibold">Riesgo</th>
                  <th className="py-2 font-semibold">Confianza</th>
                  <th className="py-2 font-semibold">Lectura</th>
                  <th className="py-2 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ranked.map(({ row, score, current }) => {
                  const style = RISK_STYLES[row.riskLevel];
                  return (
                    <tr key={row.id} className={current ? "bg-blue-500/[0.04]" : undefined}>
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/report/${row.id}`}
                          className="font-semibold text-gray-200 underline-offset-2 hover:text-white hover:underline"
                        >
                          {row.projectName}
                        </Link>
                        {current ? (
                          <span className="ml-2 rounded border border-blue-400/50 bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-200">
                            ACTUAL
                          </span>
                        ) : null}
                        {row.demoMode ? (
                          <span className="ml-2 rounded border border-fuchsia-400/50 bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-200">
                            DEMO
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 font-bold text-white">{score}/100</td>
                      <td className={`py-2.5 pr-3 font-semibold ${style.text}`}>
                        {row.overallRisk} - {row.riskLevel}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-400">
                        {row.confidence} - {row.confidenceLevel}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-400">{opportunityVerdict(score)}</td>
                      <td className="py-2.5 text-gray-500">{formatTimestamp(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CurrentRadar({ assessment }: { assessment: Assessment }) {
  const score = opportunityScore(assessment);
  const flags = topFactors(assessment, 4);
  const positiveSignals = assessment.factors
    .filter((factor) => !factor.inconclusive && factor.factorScore <= 25)
    .slice(0, 4);
  const sourcesOk = assessment.sourceStatus.filter((source) => source.status === "OK" || source.status === "STALE");
  const evidenceFindings = assessment.evidence.filter((item) => item.kind === "finding");
  const mappedFindings = evidenceFindings.filter((item) => item.geometry);

  return (
    <Panel className="overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        <div className="border-b border-white/10 bg-blue-500/[0.06] p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-blue-300" />
            <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Activo actual</p>
          </div>
          <h2 className="mt-3 text-lg font-extrabold text-white">{assessment.projectName}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
            Lectura comercial basada en el mismo motor de reglas y la misma evidencia del dossier.
          </p>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Score de interes
            </p>
            <p className="mt-1 text-4xl font-extrabold text-white">{score}</p>
            <Meter value={score} tone={score >= 70 ? "emerald" : score >= 45 ? "amber" : "red"} label="Score de interes" />
            <p className="mt-3 text-xs font-semibold text-gray-300">{opportunityVerdict(score)}</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="Riesgo" value={`${assessment.overallRisk}/100`} />
            <Metric label="Confianza" value={`${assessment.confidence}/100`} />
            <Metric label="Fuentes" value={`${sourcesOk.length}/${assessment.sourceStatus.length}`} />
            <Metric label="Evidencias" value={String(evidenceFindings.length)} />
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <InsightCard
              icon={<TrendingUp className="h-4 w-4" />}
              title="Por que genera interes"
              tone="blue"
              empty="No hay senales positivas suficientes; revisar brechas y riesgo antes de promoverlo."
              items={[
                `${sourcesOk.length} de ${assessment.sourceStatus.length} fuentes respondieron para este analisis.`,
                `${mappedFindings.length} hallazgo(s) tienen geometria visible en el mapa de evidencia.`,
                ...positiveSignals.map((factor) => `${factor.label}: severidad ${factor.factorScore}/100.`),
              ]}
            />
            <InsightCard
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Lo que frena la decision"
              tone="amber"
              empty="No hay brechas abiertas; aun asi, confirmar expediente oficial antes de transaccion."
              items={[
                ...assessment.missingChecks.slice(0, 3).map((check) => `${check.label}: ${check.blockedConclusion}`),
                ...flags.slice(0, 2).map((factor) => `${factor.label}: +${factor.contribution} puntos de riesgo.`),
              ]}
            />
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Detalle de lo encontrado</h3>
                <p className="mt-1 text-[11px] text-gray-500">
                  Este bloque explica el radar con datos trazables, no con opinion comercial.
                </p>
              </div>
              <Link
                href={`/report/${assessment.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-500"
              >
                <FileText className="h-3.5 w-3.5" />
                Ver dossier
              </Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <FindingTile
                label="Derechos y registros"
                value={String(countEvidence(assessment, ["ingemmet", "reinfo"]))}
                detail="Hallazgos o estados usados para riesgo legal y REINFO."
              />
              <FindingTile
                label="Ambiental / agua"
                value={String(countEvidence(assessment, ["sernanp", "ana"]))}
                detail="Capas que reducen o elevan restricciones ambientales e hidricas."
              />
              <FindingTile
                label="Territorial / satelital"
                value={String(countEvidence(assessment, ["bdpi", "copernicus"]))}
                detail="Contexto social-territorial y metadatos de imagen disponibles."
              />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function InsightCard({
  icon,
  title,
  tone,
  items,
  empty,
}: {
  icon: ReactNode;
  title: string;
  tone: "blue" | "amber";
  items: string[];
  empty: string;
}) {
  const filtered = items.filter(Boolean).slice(0, 5);
  const toneClass =
    tone === "blue"
      ? "border-blue-500/20 bg-blue-500/[0.06] text-blue-200"
      : "border-amber-500/25 bg-amber-500/[0.07] text-amber-200";

  return (
    <section className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">{title}</h3>
      </div>
      {filtered.length === 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-[11px] leading-relaxed">
          {filtered.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-white">{value}</p>
    </div>
  );
}

function FindingTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{detail}</p>
    </div>
  );
}

function countEvidence(assessment: Assessment, sourceKeys: string[]) {
  return assessment.evidence.filter((item) => item.kind === "finding" && sourceKeys.includes(item.sourceKey)).length;
}

function opportunityVerdict(score: number): string {
  if (score >= 75) return "Prioridad alta: merece revision comercial y legal inmediata.";
  if (score >= 55) return "Interes medio: avanzar si las brechas abiertas son cerrables.";
  if (score >= 35) return "Interes condicionado: requiere mas evidencia antes de promoverlo.";
  return "Bajo interes por ahora: el riesgo o la baja confianza pesan mas que la oportunidad.";
}
