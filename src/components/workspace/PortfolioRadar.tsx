"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, LandPlot, Radar, TrendingUp } from "lucide-react";

import type { Assessment, Project } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";
import { EmptyState, Meter, Panel, PanelHeader } from "@/components/ui/Primitives";
import { formatTimestamp, opportunityScore, RISK_STYLES, topFactors } from "@/lib/ui/format";
import MapPanel from "./MapPanel";

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
export default function PortfolioRadar({
  currentAssessment,
  project,
  onSelectEvidence,
}: {
  currentAssessment?: Assessment;
  /** Supplied so the radar can draw the area in its territorial context
   *  instead of sending the operator to another tab to see where it is. */
  project?: Project;
  onSelectEvidence?: (evidence: Evidence) => void;
}) {
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

  // Concession-level context, computed from the evidence already frozen into
  // the assessment. Nothing here re-queries a source: the radar reads the same
  // record set the dossier cites, so the two can never disagree.
  const territorial = useMemo(() => {
    if (!currentAssessment) return null;
    const findings = currentAssessment.evidence.filter((entry) => entry.kind === "finding");
    const rights = findings.filter((entry) => entry.sourceKey === "ingemmet");
    const protectedAreas = findings.filter((entry) => entry.sourceKey === "sernanp");

    const overlapPercent = rights.reduce((total, entry) => {
      const value = entry.metadata?.overlapPercentOfAoi;
      return total + (typeof value === "number" ? value : 0);
    }, 0);

    const holders = [
      ...new Set(
        rights
          .map((entry) => entry.metadata?.holder)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      ),
    ];

    return {
      rights,
      protectedAreas,
      overlapPercent: Math.min(100, Math.round(overlapPercent * 100) / 100),
      freePercent: Math.max(0, Math.round((100 - overlapPercent) * 100) / 100),
      holders,
    };
  }, [currentAssessment]);

  return (
    <div className="space-y-5">
      {currentAssessment && project && territorial ? (
        <Panel className="p-5">
          <PanelHeader
            title="Contexto territorial del área"
            subtitle="Dónde cae tu área respecto del catastro que la rodea. Cada geometría dibujada es un registro oficial congelado como evidencia; haz clic para abrir el que la respalda."
          />

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="h-[420px] overflow-hidden rounded-xl border border-white/10">
              <MapPanel
                aoi={project.geometry}
                evidence={currentAssessment.evidence}
                sources={currentAssessment.sourceStatus}
                center={currentAssessment.geometrySummary.centroid}
                onSelectEvidence={(item) => onSelectEvidence?.(item)}
              />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <ContextStat
                  label="Superposición con derechos"
                  value={`${territorial.overlapPercent}%`}
                  hint={
                    territorial.overlapPercent > 0
                      ? "Porcentaje del área ya cubierto por concesiones registradas."
                      : "Ninguna concesión registrada se superpone al área evaluada."
                  }
                  tone={territorial.overlapPercent > 50 ? "warn" : "neutral"}
                />
                <ContextStat
                  label="Superficie libre"
                  value={`${territorial.freePercent}%`}
                  hint="Parte del área sin superposición catastral detectada en las capas consultadas."
                  tone={territorial.freePercent > 50 ? "good" : "neutral"}
                />
                <ContextStat
                  label="Derechos mineros"
                  value={String(territorial.rights.length)}
                  hint="Registros del catastro minero que intersectan el área."
                  tone="neutral"
                />
                <ContextStat
                  label="Áreas protegidas"
                  value={String(territorial.protectedAreas.length)}
                  hint="Registros de áreas naturales protegidas que intersectan el área."
                  tone={territorial.protectedAreas.length > 0 ? "warn" : "good"}
                />
              </div>

              {territorial.holders.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Titulares en el entorno
                  </p>
                  <ul className="mt-2 space-y-1">
                    {territorial.holders.slice(0, 6).map((holder) => (
                      <li key={holder} className="truncate text-[11px] text-gray-300">
                        • {holder}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] leading-relaxed text-gray-600">
                    Tal como los publica el catastro. Verifica la vigencia en el portal oficial antes
                    de contactar a un titular.
                  </p>
                </div>
              ) : null}

              <p className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3 text-[11px] leading-relaxed text-blue-100/80">
                Esta lectura es de triaje comercial, no una opinión legal. Responde si el bloque está
                rodeado, cuánto espacio queda y quién es titular al lado — no si el activo es
                legalmente viable.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

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
  const concessionFindings = evidenceFindings.filter((item) => item.sourceKey === "ingemmet");

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
          <ConcessionAnalysis findings={concessionFindings} />

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

function ConcessionAnalysis({ findings }: { findings: Assessment["evidence"] }) {
  const concessions = findings.map((item) => ({
    id: item.id,
    title: item.title,
    code: textValue(item.metadata.code),
    name: textValue(item.metadata.name),
    status: textValue(item.metadata.status),
    holder: textValue(item.metadata.holder),
    substance: textValue(item.metadata.substance),
    declaredHectares: numberValue(item.metadata.declaredHectares),
    overlapHectares: numberValue(item.metadata.overlapHectares),
    overlapPercentOfAoi: numberValue(item.metadata.overlapPercentOfAoi),
    hasGeometry: Boolean(item.geometry),
  }));
  const mapped = concessions.filter((item) => item.hasGeometry);
  const totalOverlap = concessions.reduce((sum, item) => sum + (item.overlapHectares ?? 0), 0);
  const maxCoverage = concessions.reduce(
    (max, item) => Math.max(max, item.overlapPercentOfAoi ?? 0),
    0,
  );
  const principal =
    [...concessions].sort((a, b) => (b.overlapPercentOfAoi ?? 0) - (a.overlapPercentOfAoi ?? 0))[0] ??
    null;

  return (
    <section className="mb-4 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LandPlot className="h-4 w-4 text-sky-300" />
            <h3 className="text-sm font-bold text-white">Analisis de concesion minera</h3>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
            Lectura especifica de INGEMMET: derechos que intersectan el area, estado publicado,
            titular reportado y cobertura espacial usada por el radar.
          </p>
        </div>
        <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase text-sky-200">
          {concessions.length} derecho(s)
        </span>
      </div>

      {concessions.length === 0 ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-3">
          <p className="text-xs font-semibold text-white">Sin concesiones superpuestas reportadas</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            El catastro no devolvio derechos mineros intersectantes, o la fuente no pudo devolver
            hallazgos. Esto no confirma disponibilidad legal; solo reduce complejidad catastral
            preliminar si la fuente respondio correctamente.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Metric label="Derechos" value={String(concessions.length)} />
            <Metric label="Con mapa" value={String(mapped.length)} />
            <Metric label="Solape ha" value={formatSmallNumber(totalOverlap)} />
            <Metric label="Max. cobertura" value={`${formatSmallNumber(maxCoverage)}%`} />
          </div>

          {principal ? (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Derecho principal por cobertura
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <Fact label="Codigo" value={principal.code ?? "No reportado"} mono />
                <Fact label="Nombre" value={principal.name ?? principal.title} />
                <Fact label="Estado" value={principal.status ?? "No reportado"} />
                <Fact label="Titular" value={principal.holder ?? "No reportado"} />
                <Fact label="Sustancia" value={principal.substance ?? "No reportado"} />
                <Fact
                  label="Cobertura AOI"
                  value={`${formatSmallNumber(principal.overlapPercentOfAoi ?? 0)}% (${formatSmallNumber(
                    principal.overlapHectares ?? 0,
                  )} ha)`}
                />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-sky-100/90">
                Impacto en radar: una concesion titulada o en tramite no significa inviabilidad,
                pero cambia la tesis comercial: se debe revisar expediente, titular, pagos,
                gravamenes y estrategia de negociacion antes de presentar el activo como libre.
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
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

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 break-all text-xs text-gray-200 ${mono ? "font-mono" : ""}`}>{value}</p>
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

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatSmallNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: value > 0 && value < 10 ? 2 : 1,
  }).format(value);
}

function opportunityVerdict(score: number): string {
  if (score >= 75) return "Prioridad alta: merece revision comercial y legal inmediata.";
  if (score >= 55) return "Interes medio: avanzar si las brechas abiertas son cerrables.";
  if (score >= 35) return "Interes condicionado: requiere mas evidencia antes de promoverlo.";
  return "Bajo interes por ahora: el riesgo o la baja confianza pesan mas que la oportunidad.";
}

/** Compact figure with the sentence that says how to read it. */
function ContextStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : "text-gray-100";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[10px] leading-snug text-gray-500">{hint}</p>
    </div>
  );
}
