"use client";

import { ChevronRight, HelpCircle, TrendingUp } from "lucide-react";

import type { Assessment, RiskFactorResult } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";
import {
  DemoBanner,
  Meter,
  Panel,
  PanelHeader,
  ScoreTile,
  ScreeningDisclaimer,
  StatusBadge,
} from "@/components/ui/Primitives";
import { formatHectares, formatTimestamp, topFactors } from "@/lib/ui/format";
import { track } from "@/lib/analytics/client";

/**
 * Results screen hierarchy (Plan Maestro §4.4):
 * overall risk and confidence → dimensions with point contributions → top red
 * flags with evidence → what could not be verified → dossier CTA.
 */
export default function RiskExplorer({
  assessment,
  onOpenEvidence,
}: {
  assessment: Assessment;
  onOpenEvidence: (evidence: Evidence[], factorKey: string) => void;
}) {
  const evidenceById = new Map(assessment.evidence.map((e) => [e.id, e] as const));
  const redFlags = topFactors(assessment, 3);

  const openEvidence = (factor: RiskFactorResult) => {
    const items = factor.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((e): e is Evidence => Boolean(e));
    track("factor_opened", { factor_key: factor.factorKey });
    onOpenEvidence(items, factor.factorKey);
  };

  return (
    <div className="space-y-6">
      {assessment.demoMode ? <DemoBanner /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreTile
          label="Riesgo general del tamizaje"
          value={assessment.overallRisk}
          level={assessment.riskLevel}
          tone="risk"
          caption="Ponderado sobre las dimensiones que sí pudieron evaluarse. Cada punto se rastrea hasta un factor y su evidencia."
        />
        <ScoreTile
          label="Confianza del dato"
          value={assessment.confidence}
          level={assessment.confidenceLevel}
          tone="confidence"
          caption="Completitud, frescura y autoridad de la evidencia. Va aparte del riesgo a propósito: un puntaje alto con datos pobres no puede leerse como certeza."
        />
      </div>

      {assessment.riskLevel === "NOT_ASSESSED" ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
          <strong className="font-semibold">No se calculó ningún riesgo.</strong> Ninguna dimensión
          pudo evaluarse con las fuentes disponibles, así que no hay puntaje — solo ausencia de
          medición. Esto NO significa riesgo bajo. Configura los conectores oficiales, o resuelve
          los vacíos listados en &ldquo;No verificado&rdquo;, y vuelve a ejecutar.
        </p>
      ) : null}

      {assessment.riskLevel !== "NOT_ASSESSED" && assessment.confidenceLevel === "LOW" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
          La confianza del dato es baja. Toma el número de riesgo solo como señal provisional y resuelve
          los vacíos listados en &ldquo;No verificado&rdquo; antes de que influya en cualquier decisión.
        </p>
      ) : null}

      <Panel className="p-5" demo={assessment.demoMode}>
        <PanelHeader
          title="Dimensiones de riesgo"
          subtitle={`Motor de reglas ${assessment.ruleVersion}. Las dimensiones que no pudieron evaluarse se excluyen y su peso se redistribuye, para que el total siga en escala 0–100.`}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assessment.dimensions.map((dimension) => (
            <div
              key={dimension.key}
              className={`rounded-xl border p-4 ${
                dimension.inconclusive
                  ? "border-white/10 bg-white/[0.02] opacity-70"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-white">{dimension.label}</h4>
                <span className="shrink-0 text-[10px] font-semibold text-gray-500">
                  {Math.round(dimension.weight * 100)}% peso
                </span>
              </div>
              {dimension.inconclusive ? (
                <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                  No evaluada — ninguna fuente detrás de esta dimensión pudo responder. Aporta 0
                  puntos y reduce la confianza del dato.
                </p>
              ) : (
                <>
                  <p className="mt-2.5 text-2xl font-extrabold text-white">
                    {dimension.score}
                    <span className="text-sm font-semibold text-gray-500">/100</span>
                  </p>
                  <div className="mt-2">
                    <Meter
                      value={dimension.score}
                      tone={dimension.score >= 60 ? "red" : dimension.score >= 30 ? "amber" : "emerald"}
                      label={`${dimension.label} score`}
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-blue-300">
                    +{dimension.contribution} puntos al puntaje total
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5" demo={assessment.demoMode}>
        <PanelHeader
          title="Principales señales de alerta"
          subtitle="Los factores que más puntos aportan al total, cada uno con la evidencia que lo sustenta."
        />
        {redFlags.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/15 px-4 py-6 text-center text-xs text-gray-500">
            Ningún factor produjo una contribución positiva. O el área está limpia según las
            verificaciones que corrieron, o corrieron muy pocas — contrasta con la confianza del dato
            de arriba.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {redFlags.map((factor) => (
              <li key={factor.factorKey}>
                <FactorCard factor={factor} onOpen={() => openEvidence(factor)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-5" demo={assessment.demoMode}>
        <PanelHeader
          title="Todos los factores"
          subtitle="Factor → score → contribución → evidencia. Los factores inconclusos también se listan; nunca se ocultan."
        />
        <ul className="mt-4 space-y-2.5">
          {assessment.factors.map((factor) => (
            <li key={factor.factorKey}>
              <FactorCard factor={factor} onOpen={() => openEvidence(factor)} compact />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-5">
        <PanelHeader title="Alcance y geometría" subtitle="Qué se tamizó exactamente." />
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Área" value={formatHectares(assessment.geometrySummary.areaHectares)} />
          <Detail label="Vértices" value={String(assessment.geometrySummary.vertexCount)} />
          <Detail label="Formato de origen" value={assessment.geometrySummary.format.toUpperCase()} />
          <Detail label="Huella de geometría" value={assessment.geometrySummary.geometryHash} mono />
          <Detail
            label="Centroide"
            value={`${assessment.geometrySummary.centroid[1]}, ${assessment.geometrySummary.centroid[0]}`}
            mono
          />
          <Detail label="ID de evaluación" value={assessment.id} mono />
          <Detail label="Versión de reglas" value={assessment.ruleVersion} mono />
          <Detail label="Ejecutado" value={formatTimestamp(assessment.createdAt)} />
        </dl>
      </Panel>

      <ScreeningDisclaimer />
    </div>
  );
}

function FactorCard({
  factor,
  onOpen,
  compact = false,
}: {
  factor: RiskFactorResult;
  onOpen: () => void;
  compact?: boolean;
}) {
  const tone = factor.inconclusive
    ? "border-white/10 bg-white/[0.02]"
    : factor.factorScore >= 60
      ? "border-red-500/25 bg-red-500/[0.06]"
      : factor.factorScore >= 30
        ? "border-amber-500/25 bg-amber-500/[0.06]"
        : "border-emerald-500/20 bg-emerald-500/[0.05]";

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-white">{factor.label}</h4>
            <StatusBadge status={factor.dataStatus} />
            <span className="font-mono text-[10px] text-gray-500">{factor.ruleId}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-300">{factor.rationale}</p>
        </div>
        <div className="shrink-0 text-right">
          {factor.inconclusive ? (
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Inconclusive
            </span>
          ) : (
            <>
              <p className="flex items-center justify-end gap-1 text-lg font-extrabold text-white">
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />+{factor.contribution}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                points · severity {factor.factorScore}/100
              </p>
            </>
          )}
        </div>
      </div>

      {!compact && factor.nextStep ? (
        <p className="mt-3 flex items-start gap-1.5 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-gray-400">
          <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-gray-500" />
          <span>
            <strong className="font-semibold text-gray-300">Next step:</strong> {factor.nextStep}
          </span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 transition hover:text-blue-300"
      >
        View evidence ({factor.evidenceIds.length})
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className={`mt-1 break-all text-gray-200 ${mono ? "font-mono text-[10px]" : "text-xs"}`}>
        {value}
      </dd>
    </div>
  );
}
