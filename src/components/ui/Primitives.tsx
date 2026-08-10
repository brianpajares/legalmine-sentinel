import type { ReactNode } from "react";
import type { SourceStatus, SourceTier } from "@/types/sources";
import type { ConfidenceLevel, RiskLevel } from "@/types/assessment";
import {
  CONFIDENCE_STYLES,
  RISK_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  TIER_LABELS,
  TIER_STYLES,
} from "@/lib/ui/format";

export function Panel({
  children,
  className = "",
  demo = false,
}: {
  children: ReactNode;
  className?: string;
  demo?: boolean;
}) {
  return (
    <section
      className={`glass-panel print-surface ${demo ? "demo-surface" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h3 className="font-bold text-base text-white tracking-tight">{title}</h3>
        {subtitle ? <p className="text-xs text-gray-400 mt-0.5 print-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: SourceStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TierBadge({ tier }: { tier: SourceTier }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${TIER_STYLES[tier]}`}
      title={
        tier === "demo"
          ? "Fictional record shown for demonstration only."
          : tier === "official"
            ? "Published by the authoritative government body."
            : tier === "reference"
              ? "Contextual data, not an authoritative record."
              : "Supplied by the user."
      }
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

export function RiskBadge({ level, score }: { level: RiskLevel; score: number }) {
  const style = RISK_STYLES[level];
  const assessed = level !== "NOT_ASSESSED";
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}
      title={assessed ? undefined : "No risk dimension could be evaluated, so no score was produced."}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {assessed ? `${level} · ${score}/100` : "NOT ASSESSED"}
    </span>
  );
}

export function ConfidenceBadge({ level, score }: { level: ConfidenceLevel; score: number }) {
  const style = CONFIDENCE_STYLES[level];
  return (
    <span
      className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}
    >
      {level} CONFIDENCE · {score}/100
    </span>
  );
}

/** Horizontal meter used for dimension scores and confidence components. */
export function Meter({
  value,
  max = 100,
  tone = "blue",
  label,
}: {
  value: number;
  max?: number;
  tone?: "blue" | "red" | "amber" | "emerald" | "gray";
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const tones: Record<string, string> = {
    blue: "bg-blue-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    gray: "bg-gray-600",
  };
  return (
    <div className="w-full">
      {label ? <span className="sr-only">{label}</span> : null}
      <div
        className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? "score"}
      >
        <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Big headline number for the two scores that lead every result screen. */
export function ScoreTile({
  label,
  value,
  suffix = "/100",
  level,
  tone,
  caption,
}: {
  label: string;
  value: number;
  suffix?: string;
  level: string;
  tone: "risk" | "confidence";
  caption?: string;
}) {
  const color =
    tone === "risk"
      ? RISK_STYLES[(level as RiskLevel) in RISK_STYLES ? (level as RiskLevel) : "MODERATE"]
      : CONFIDENCE_STYLES[
          (level as ConfidenceLevel) in CONFIDENCE_STYLES ? (level as ConfidenceLevel) : "MEDIUM"
        ];
  // A score of 0 that nothing produced must not be shown as a number: an
  // unmeasured area would otherwise read as a clean one.
  const assessed = level !== "NOT_ASSESSED";
  return (
    <div className={`rounded-xl border p-5 ${color.bg} ${color.border} print-surface`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 print-muted">{label}</p>
      <p className={`mt-1 text-4xl font-extrabold tracking-tight ${color.text}`}>
        {assessed ? value : "—"}
        {assessed ? (
          <span className="text-lg font-semibold text-gray-400 print-muted">{suffix}</span>
        ) : null}
      </p>
      <p className={`text-xs font-bold uppercase tracking-wide ${color.text}`}>
        {assessed ? level : "NOT ASSESSED"}
      </p>
      {caption ? <p className="mt-2 text-[11px] text-gray-400 leading-relaxed print-muted">{caption}</p> : null}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/15 px-4 py-3 text-xs text-fuchsia-100">
      <strong className="font-bold uppercase tracking-wide">Demo data</strong> — every record in this
      assessment is fictional and produced from a local fixture. No government service was queried.
      Registration status and satellite imagery are never simulated, not even here.
    </div>
  );
}

export function ScreeningDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-[11px] leading-relaxed text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 print-surface ${className}`}
    >
      <strong className="font-semibold">Preliminary screening — not legal advice.</strong> LegalMine
      Sentinel combines official and referenced datasets to flag issues worth investigating. It does
      not establish legality, viability or title, and it does not replace review by qualified legal,
      environmental or land professionals.
    </p>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center">
      <p className="text-sm font-semibold text-gray-300">{title}</p>
      <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto leading-relaxed">{detail}</p>
    </div>
  );
}
