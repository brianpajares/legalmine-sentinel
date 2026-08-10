"use client";

import type { SourceStatusSummary } from "@/types/assessment";
import { Panel, PanelHeader, StatusBadge } from "@/components/ui/Primitives";
import { formatTimestamp } from "@/lib/ui/format";

/**
 * Coverage matrix (Plan Maestro §4.3 step 2).
 *
 * The point of this screen is the opposite of a green dashboard: it makes the
 * sources that did not answer as visible as the ones that did.
 */
export default function SourceCheck({ sources }: { sources: SourceStatusSummary[] }) {
  const answered = sources.filter((s) => s.status === "OK" || s.status === "STALE");

  return (
    <Panel className="p-5">
      <PanelHeader
        title="Source check"
        subtitle={`${answered.length} of ${sources.length} sources answered for this area of interest.`}
      />

      <div className="mt-4 space-y-3">
        {sources.map((source) => (
          <article key={source.sourceKey} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white">{source.sourceName}</h4>
                <p className="mt-1 text-[11px] text-gray-500">
                  Queried {formatTimestamp(source.fetchedAt)}
                  {source.validAt ? ` · source validity ${formatTimestamp(source.validAt)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {source.official ? "Official" : "Non-official"}
                </span>
                <StatusBadge status={source.status} />
              </div>
            </div>

            <p className="mt-2.5 text-[11px] font-semibold text-gray-400">
              {source.recordCount} record(s) returned
            </p>

            {source.warnings.length > 0 ? (
              <ul className="mt-2.5 space-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] p-2.5 text-[11px] leading-relaxed text-amber-200">
                {source.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            {source.sourceUrl ? (
              <p className="mt-2.5 break-all font-mono text-[10px] text-gray-600">{source.sourceUrl}</p>
            ) : null}
          </article>
        ))}
      </div>
    </Panel>
  );
}
