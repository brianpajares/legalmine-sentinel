import { randomUUID } from "node:crypto";

import type {
  Assessment,
  ConfidenceBreakdown,
  ConfidenceLevel,
  DimensionResult,
  MissingCheck,
  RiskFactorResult,
  RiskLevel,
} from "@/types/assessment";
import type { GeometrySummary } from "@/types/geo";
import { isConclusive } from "@/types/sources";
import { round } from "@/lib/geo/measure";
import {
  allSourceResults,
  summarizeSources,
  type EvidenceBundle,
} from "@/lib/sources/collect";
import { P0_SOURCE_KEYS, SOURCE_DEFINITIONS } from "@/lib/sources/config";
import { DIMENSIONS, RULE_SETS, RULE_VERSION, type Rule } from "@/lib/rules/v1";

/**
 * The scoring engine (Plan Maestro §7).
 *
 * Given the same evidence bundle and the same rule version, this function
 * returns the same numbers every time. There is no randomness, no clock-derived
 * arithmetic and no model call anywhere in the computation.
 */

export function riskLevel(score: number, scored = true): RiskLevel {
  if (!scored) return "NOT_ASSESSED";
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

interface EvaluatedFactor {
  rule: Rule;
  result: RiskFactorResult;
  missingCheck?: MissingCheck;
}

function evaluateRules(bundle: EvidenceBundle, rules: Rule[]): EvaluatedFactor[] {
  return rules.map((rule) => {
    const outcome = rule.evaluate(bundle);
    return {
      rule,
      missingCheck: outcome.missingCheck,
      result: {
        factorKey: rule.factorKey,
        ruleId: rule.id,
        dimension: rule.dimension,
        label: rule.label,
        factorScore: round(outcome.factorScore, 2),
        weight: rule.weight,
        contribution: 0,
        evidenceIds: outcome.evidenceIds,
        rationale: outcome.rationale,
        dataStatus: outcome.dataStatus,
        nextStep: outcome.nextStep,
        inconclusive: outcome.inconclusive,
      },
    };
  });
}

/**
 * Confidence is deliberately separate from risk (§7.3): a high risk number with
 * low confidence must read as "verify before acting", not as certainty.
 */
function computeConfidence(
  bundle: EvidenceBundle,
  dimensions: { key: string; weight: number; inconclusive: boolean }[],
): ConfidenceBreakdown {
  const notes: string[] = [];

  const answeredWeight = dimensions
    .filter((d) => !d.inconclusive)
    .reduce((sum, d) => sum + d.weight, 0);
  const completeness = round(answeredWeight * 100, 2);
  const missing = dimensions.filter((d) => d.inconclusive);
  if (missing.length > 0) {
    notes.push(
      `${missing.length} of ${dimensions.length} risk dimensions could not be evaluated: ${missing
        .map((d) => d.key)
        .join(", ")}.`,
    );
  }

  const sources = allSourceResults(bundle);
  const conclusiveSources = sources.filter((s) => isConclusive(s.status));

  let freshness = 0;
  if (conclusiveSources.length > 0) {
    const scores = conclusiveSources.map((source) => {
      const definition = SOURCE_DEFINITIONS[source.sourceKey];
      const budgetMs = (definition?.freshnessBudgetHours ?? 168) * 3600 * 1000;
      const reference = source.validAt ?? source.fetchedAt;
      const ageMs = Math.max(0, Date.parse(source.fetchedAt) - Date.parse(reference));
      if (source.status === "STALE") return 50;
      if (ageMs <= budgetMs) return 100;
      return Math.max(30, 100 - ((ageMs - budgetMs) / budgetMs) * 50);
    });
    freshness = round(scores.reduce((a, b) => a + b, 0) / scores.length, 2);
  } else {
    notes.push("No source produced a usable answer, so freshness could not be scored.");
  }

  let authority = 0;
  if (conclusiveSources.length > 0) {
    const weights = conclusiveSources.map(
      (s) => (s.official ? 1 : 0.5) * (SOURCE_DEFINITIONS[s.sourceKey]?.authorityWeight ?? 0.8),
    );
    authority = round((weights.reduce((a, b) => a + b, 0) / conclusiveSources.length) * 100, 2);
  }

  const unavailable = sources.filter((s) => !isConclusive(s.status));
  for (const source of unavailable) {
    notes.push(`${source.sourceName}: ${source.status.replace(/_/g, " ").toLowerCase()}.`);
  }

  const total = round(0.4 * completeness + 0.3 * freshness + 0.3 * authority, 2);
  return { completeness, freshness, authority, total, notes };
}

export interface RunAssessmentInput {
  projectId: string;
  projectName: string;
  geometrySummary: GeometrySummary;
  bundle: EvidenceBundle;
  ruleVersion?: string;
  demoMode?: boolean;
  startedAt?: number;
}

export function runAssessment(input: RunAssessmentInput): Assessment {
  const ruleVersion = input.ruleVersion ?? RULE_VERSION;
  const rules = RULE_SETS[ruleVersion];
  if (!rules) {
    throw new Error(
      `Unknown rule version "${ruleVersion}". Available versions: ${Object.keys(RULE_SETS).join(", ")}.`,
    );
  }

  const startedAt = input.startedAt ?? Date.now();
  const evaluated = evaluateRules(input.bundle, rules);

  // Dimension aggregation. Factor weights inside a dimension are renormalized
  // across the factors that could actually be evaluated.
  const dimensions: DimensionResult[] = DIMENSIONS.map((definition) => {
    const members = evaluated.filter((e) => e.rule.dimension === definition.key);
    const conclusive = members.filter((e) => !e.result.inconclusive);
    const weightSum = conclusive.reduce((sum, e) => sum + e.rule.weight, 0);
    const score =
      weightSum > 0
        ? round(
            conclusive.reduce((sum, e) => sum + (e.rule.weight / weightSum) * e.result.factorScore, 0),
            2,
          )
        : 0;
    return {
      key: definition.key,
      label: definition.label,
      weight: definition.weight,
      effectiveWeight: 0,
      score,
      contribution: 0,
      factorKeys: members.map((e) => e.result.factorKey),
      inconclusive: conclusive.length === 0,
    };
  });

  // Redistribute the weight of inconclusive dimensions across the rest, so the
  // overall score stays on 0-100 and every point traces back to a factor.
  const conclusiveDimensions = dimensions.filter((d) => !d.inconclusive);
  const nominalSum = conclusiveDimensions.reduce((sum, d) => sum + d.weight, 0);
  for (const dimension of dimensions) {
    dimension.effectiveWeight =
      dimension.inconclusive || nominalSum === 0 ? 0 : round(dimension.weight / nominalSum, 6);
    dimension.contribution = round(dimension.effectiveWeight * dimension.score, 2);
  }

  const overallRisk = round(
    dimensions.reduce((sum, d) => sum + d.effectiveWeight * d.score, 0),
    2,
  );

  // Attribute the dimension's points back to the factors that produced them.
  for (const dimension of dimensions) {
    const members = evaluated.filter((e) => e.rule.dimension === dimension.key);
    const conclusive = members.filter((e) => !e.result.inconclusive);
    const weightSum = conclusive.reduce((sum, e) => sum + e.rule.weight, 0);
    for (const member of members) {
      member.result.contribution = member.result.inconclusive || weightSum === 0
        ? 0
        : round(
            dimension.effectiveWeight * (member.rule.weight / weightSum) * member.result.factorScore,
            2,
          );
    }
  }

  const factors = evaluated.map((e) => e.result);
  const missingChecks = evaluated
    .map((e) => e.missingCheck)
    .filter((c): c is MissingCheck => Boolean(c));

  const confidenceBreakdown = computeConfidence(input.bundle, dimensions);
  const sourceStatus = summarizeSources(input.bundle);
  const p0Answered = P0_SOURCE_KEYS.every((key) => {
    const source = sourceStatus.find((s) => s.sourceKey === key);
    return source ? isConclusive(source.status) : false;
  });

  return {
    id: `asm_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    projectId: input.projectId,
    projectName: input.projectName,
    ruleVersion,
    createdAt: new Date().toISOString(),
    status: p0Answered ? "COMPLETED" : "PARTIAL",
    overallRisk,
    riskLevel: riskLevel(overallRisk, conclusiveDimensions.length > 0),
    confidence: confidenceBreakdown.total,
    confidenceLevel: confidenceLevel(confidenceBreakdown.total),
    confidenceBreakdown,
    dimensions,
    factors,
    missingChecks,
    sourceStatus,
    evidence: input.bundle.evidence,
    geometrySummary: input.geometrySummary,
    demoMode: input.demoMode ?? false,
    basisMode: input.bundle.basisMode,
    corpusBasis: input.bundle.corpusBasis,
    durationMs: Date.now() - startedAt,
  };
}

/** The headline sentence used in the UI and the dossier, phrased for screening. */
export function headline(assessment: Assessment): string {
  if (assessment.riskLevel === "NOT_ASSESSED") {
    return (
      "No screening risk could be calculated: not a single risk dimension could be evaluated with the sources available to this assessment. " +
      "The score of 0 reflects the absence of measurement, not the absence of risk."
    );
  }
  const risk = `${assessment.riskLevel.toLowerCase()} preliminary screening risk (${assessment.overallRisk}/100)`;
  const confidence = `${assessment.confidenceLevel.toLowerCase()} data confidence (${assessment.confidence}/100)`;
  if (assessment.confidenceLevel === "LOW") {
    return `${capitalize(risk)} with ${confidence} — verification required before any decision.`;
  }
  return `${capitalize(risk)} with ${confidence}.`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
