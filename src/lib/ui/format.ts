import type {
  Assessment,
  ConfidenceLevel,
  RiskLevel,
  SourceStatusSummary,
} from "@/types/assessment";
import type { SourceStatus, SourceTier } from "@/types/sources";

export const RISK_STYLES: Record<RiskLevel, { text: string; bg: string; border: string; dot: string }> = {
  NOT_ASSESSED: { text: "text-gray-300", bg: "bg-white/5", border: "border-white/20", dot: "bg-gray-400" },
  LOW: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  MODERATE: { text: "text-yellow-300", bg: "bg-yellow-500/10", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  HIGH: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" },
  CRITICAL: { text: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-400" },
};

export const CONFIDENCE_STYLES: Record<ConfidenceLevel, { text: string; bg: string; border: string }> = {
  LOW: { text: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30" },
  MEDIUM: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  HIGH: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
};

export const STATUS_LABELS: Record<SourceStatus, string> = {
  OK: "Conectado",
  STALE: "Desactualizado",
  UNAVAILABLE: "No disponible",
  MANUAL_VERIFICATION_REQUIRED: "Verificacion manual",
  NOT_CONFIGURED: "No configurado",
};

export const STATUS_STYLES: Record<SourceStatus, { text: string; bg: string; border: string }> = {
  OK: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  STALE: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  UNAVAILABLE: { text: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30" },
  MANUAL_VERIFICATION_REQUIRED: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  NOT_CONFIGURED: { text: "text-gray-300", bg: "bg-white/5", border: "border-white/15" },
};

export const TIER_LABELS: Record<SourceTier, string> = {
  official: "Oficial",
  reference: "Referencia",
  user_provided: "Provisto por usuario",
  demo: "DEMO",
};

export const TIER_STYLES: Record<SourceTier, string> = {
  official: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  reference: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  user_provided: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  demo: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50",
};

/** Formats a UTC instant in Peru time, the reference timezone for the sources. */
export function formatTimestamp(iso: string | undefined | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(date) + " PET";
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "America/Lima" }).format(date);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatHectares(value: number): string {
  return `${formatNumber(value, value < 10 ? 2 : 0)} ha`;
}

/** Sorts factors by the points they actually contribute, largest first. */
export function topFactors(assessment: Assessment, count: number) {
  return [...assessment.factors]
    .filter((f) => !f.inconclusive && f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, count);
}

export function conclusiveSources(sources: SourceStatusSummary[]): SourceStatusSummary[] {
  return sources.filter((s) => s.status === "OK" || s.status === "STALE");
}

/**
 * Screening opportunity score (Plan Maestro §8).
 *
 * Deliberately derived from the same assessment as the risk score rather than
 * from a separate table of hand-picked values: an area is worth a closer look
 * when screening risk is low AND the data behind that conclusion is solid.
 * It never asserts that an opportunity is legally viable or safe.
 */
export function opportunityScore(assessment: Assessment): number {
  // An unmeasured area is not an opportunity; it is an unknown.
  if (assessment.riskLevel === "NOT_ASSESSED") return 0;
  const inverseRisk = 100 - assessment.overallRisk;
  return Math.round((inverseRisk * 0.6 + assessment.confidence * 0.4) * 100) / 100;
}
