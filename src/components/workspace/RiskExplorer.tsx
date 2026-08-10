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
          label="Overall screening risk"
          value={assessment.overallRisk}
          level={assessment.riskLevel}
          tone="risk"
          caption="Weighted across the dimensions that could be evaluated. Every point traces back to a factor and its evidence."
        />
        <ScoreTile
          label="Data confidence"
          value={assessment.confidence}
          level={assessment.confidenceLevel}
          tone="confidence"
          caption="Completeness, freshness and authority of the evidence — deliberately separate from risk, so a high score with thin data cannot read as certainty."
        />
      </div>

      {assessment.riskLevel === "NOT_ASSESSED" ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
          <strong className="font-semibold">No risk was calculated.</strong> Not a single dimension
          could be evaluated with the sources available to this assessment, so there is no score —
          only an absence of measurement. Configure the official connectors, or resolve the gaps
          listed under &ldquo;What we could not verify&rdquo;, and run it again.
        </p>
      ) : null}

      {assessment.riskLevel !== "NOT_ASSESSED" && assessment.confidenceLevel === "LOW" ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
          Data confidence is low. Treat the risk number as a provisional signal only, and resolve the
          gaps listed under &ldquo;What we could not verify&rdquo; before it informs any decision.
        </p>
      ) : null}

      <Panel className="p-5" demo={assessment.demoMode}>
        <PanelHeader
          title="Risk dimensions"
          subtitle={`Rule set ${assessment.ruleVersion}. Dimensions that could not be evaluated are excluded and their weight is redistributed, so the total stays on a 0–100 scale.`}
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
                  {Math.round(dimension.weight * 100)}% weight
                </span>
              </div>
              {dimension.inconclusive ? (
                <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                  Not evaluated — no source behind this dimension could answer. It contributes 0
                  points and lowers data confidence.
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
                    +{dimension.contribution} points to the overall score
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5" demo={assessment.demoMode}>
        <PanelHeader
          title="Top red flags"
          subtitle="The factors contributing the most points, each with the evidence behind it."
        />
        {redFlags.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/15 px-4 py-6 text-center text-xs text-gray-500">
            No factor produced a positive contribution. Either the area is clean against the checks
            that ran, or too few checks could run — compare against data confidence above.
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
          title="All factors"
          subtitle="Factor → score → contribution → evidence. Inconclusive factors are listed too, never hidden."
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
        <PanelHeader title="Scope & geometry" subtitle="What exactly was screened." />
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Area" value={formatHectares(assessment.geometrySummary.areaHectares)} />
          <Detail label="Vertices" value={String(assessment.geometrySummary.vertexCount)} />
          <Detail label="Input format" value={assessment.geometrySummary.format.toUpperCase()} />
          <Detail label="Geometry hash" value={assessment.geometrySummary.geometryHash} mono />
          <Detail
            label="Centroid"
            value={`${assessment.geometrySummary.centroid[1]}, ${assessment.geometrySummary.centroid[0]}`}
            mono
          />
          <Detail label="Assessment ID" value={assessment.id} mono />
          <Detail label="Rule version" value={assessment.ruleVersion} mono />
          <Detail label="Run at" value={formatTimestamp(assessment.createdAt)} />
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
