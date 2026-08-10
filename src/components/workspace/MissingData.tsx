"use client";

import { AlertOctagon } from "lucide-react";

import type { Assessment } from "@/types/assessment";
import { Panel, PanelHeader } from "@/components/ui/Primitives";

/**
 * "What we could not verify" (Plan Maestro §4.4).
 *
 * This screen exists because credibility comes from stating the limits of the
 * analysis, not from filling every field. Each gap names the conclusion it
 * blocks and the action that would close it.
 */
export default function MissingData({ assessment }: { assessment: Assessment }) {
  return (
    <Panel className="p-5">
      <PanelHeader
        title="What we could not verify"
        subtitle={`${assessment.missingChecks.length} open due-diligence gap(s) in this assessment.`}
      />

      {assessment.missingChecks.length === 0 ? (
        <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-4 text-xs leading-relaxed text-emerald-200">
          Every rule in this version was evaluated with live data. That does not make the screening
          exhaustive — it means no configured check was skipped.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {assessment.missingChecks.map((check) => (
            <li
              key={check.key}
              className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4"
            >
              <div className="flex items-start gap-2.5">
                <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-amber-200">
                    {check.label}
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{check.reason}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                    <strong className="font-semibold text-gray-300">Conclusion blocked:</strong>{" "}
                    {check.blockedConclusion}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-blue-300">
                    <strong className="font-semibold">Next:</strong> {check.suggestedAction}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {assessment.confidenceBreakdown.notes.length > 0 ? (
        <div className="mt-5 border-t border-white/10 pt-4">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Confidence notes
          </h4>
          <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-gray-400">
            {assessment.confidenceBreakdown.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Completeness", value: assessment.confidenceBreakdown.completeness, weight: "40%" },
              { label: "Freshness", value: assessment.confidenceBreakdown.freshness, weight: "30%" },
              { label: "Authority", value: assessment.confidenceBreakdown.authority, weight: "30%" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {item.label} · {item.weight}
                </dt>
                <dd className="mt-1 text-lg font-extrabold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </Panel>
  );
}
