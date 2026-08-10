import type { Evidence } from "./evidence";
import type { SourceStatus } from "./sources";
import type { GeoGeometry, GeometrySummary } from "./geo";

export type RiskDimensionKey =
  | "legal_tenure"
  | "environmental"
  | "territorial"
  | "water_physical"
  | "remote_sensing";

/**
 * NOT_ASSESSED is distinct from LOW on purpose: when no dimension could be
 * evaluated the score is 0 only because nothing was measured, and presenting
 * that as "low risk" would be the most dangerous thing this product could say.
 */
export type RiskLevel = "NOT_ASSESSED" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Project {
  id: string;
  orgId: string;
  name: string;
  country: string;
  geometry: GeoGeometry;
  geometrySummary: GeometrySummary;
  createdAt: string;
  /** True when the project was seeded from demo fixtures rather than a real upload. */
  demo: boolean;
  notes?: string;
}

export interface RiskFactorResult {
  factorKey: string;
  ruleId: string;
  dimension: RiskDimensionKey;
  label: string;
  /** Normalized severity 0-100 for this factor alone. */
  factorScore: number;
  /** Weight inside its dimension (weights within a dimension sum to 1). */
  weight: number;
  /** Points this factor adds to the overall 0-100 score. Computed, never authored. */
  contribution: number;
  evidenceIds: string[];
  /** Templated sentence explaining the number. Structured, not model-generated. */
  rationale: string;
  /** Status of the data behind this factor. Drives confidence, never risk. */
  dataStatus: SourceStatus;
  /** What a human should do next about this factor. */
  nextStep?: string;
  /** True when the rule could not be evaluated and is excluded from the score. */
  inconclusive: boolean;
}

export interface DimensionResult {
  key: RiskDimensionKey;
  label: string;
  /** Configured weight from the rule set. */
  weight: number;
  /**
   * Weight actually applied. When a dimension is inconclusive its nominal
   * weight is redistributed across the dimensions that could be evaluated, so
   * the overall score stays on a 0-100 scale and every point is attributable.
   */
  effectiveWeight: number;
  /** 0-100 within the dimension. */
  score: number;
  /** Points contributed to the overall score. */
  contribution: number;
  factorKeys: string[];
  /** True when no factor in this dimension could be evaluated. */
  inconclusive: boolean;
}

export interface ConfidenceBreakdown {
  completeness: number;
  freshness: number;
  authority: number;
  /** Weighted result, 0-100. */
  total: number;
  notes: string[];
}

export interface MissingCheck {
  key: string;
  label: string;
  reason: string;
  /** What conclusion is explicitly NOT available because of this gap. */
  blockedConclusion: string;
  suggestedAction: string;
}

export interface SourceStatusSummary {
  sourceKey: string;
  sourceName: string;
  official: boolean;
  status: SourceStatus;
  fetchedAt: string;
  validAt?: string;
  sourceUrl?: string;
  recordCount: number;
  warnings: string[];
}

export interface Assessment {
  id: string;
  projectId: string;
  projectName: string;
  ruleVersion: string;
  createdAt: string;
  /** COMPLETED when every P0 source answered; PARTIAL otherwise. */
  status: "COMPLETED" | "PARTIAL";
  overallRisk: number;
  riskLevel: RiskLevel;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  confidenceBreakdown: ConfidenceBreakdown;
  dimensions: DimensionResult[];
  factors: RiskFactorResult[];
  missingChecks: MissingCheck[];
  sourceStatus: SourceStatusSummary[];
  evidence: Evidence[];
  geometrySummary: GeometrySummary;
  /** True when any input to this assessment came from demo fixtures. */
  demoMode: boolean;
  durationMs: number;
}

export interface PilotFeedback {
  id: string;
  assessmentId?: string;
  projectId?: string;
  roleOrCompanyType: string;
  manualBaselineMinutes?: number;
  legalmineMinutes?: number;
  usefulness: number;
  trust: number;
  mostValuableFactor?: string;
  missingData?: string;
  wouldUseAgain: boolean;
  wtpHypothesis?: string;
  permissionToQuote: boolean;
  quote?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  plan?: string;
  message?: string;
  source: string;
  createdAt: string;
}
