"use client";

import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";

import type { Evidence } from "@/types/evidence";
import { StatusBadge, TierBadge } from "@/components/ui/Primitives";
import { formatTimestamp } from "@/lib/ui/format";

/**
 * Source drawer (Plan Maestro §6.2).
 *
 * Required contents: the official source name, what it supports, when it was
 * queried, its validity date when published, a link or identifier, the tier
 * badge, and the limitations the source declares.
 */
export default function EvidenceDrawer({
  evidence,
  onClose,
}: {
  evidence: Evidence[] | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!evidence) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [evidence, onClose]);

  if (!evidence) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <button
        type="button"
        aria-label="Close evidence drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0b0f19] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-white">Evidence</h3>
            <p className="text-[11px] text-gray-500">
              {evidence.length} record(s) frozen at assessment time
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {evidence.length === 0 ? (
            <p className="text-xs text-gray-500">
              No evidence record is attached to this factor. That is itself a finding — the factor is
              reported as inconclusive rather than scored.
            </p>
          ) : (
            evidence.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${
                  item.tier === "demo" ? "demo-surface" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <TierBadge tier={item.tier} />
                  <StatusBadge status={item.status} />
                </div>
                <h4 className="mt-2.5 text-sm font-bold leading-snug text-white">{item.title}</h4>
                <p className="mt-1 text-[11px] font-semibold text-gray-400">{item.sourceName}</p>
                {item.detail ? (
                  <p className="mt-2 text-xs leading-relaxed text-gray-400">{item.detail}</p>
                ) : null}

                <dl className="mt-3 space-y-1 border-t border-white/5 pt-3 text-[11px]">
                  <Row label="Queried at" value={formatTimestamp(item.fetchedAt)} />
                  {item.validAt ? <Row label="Source validity" value={formatTimestamp(item.validAt)} /> : null}
                  {item.observedAt ? <Row label="Observed at" value={formatTimestamp(item.observedAt)} /> : null}
                  <Row label="Evidence ID" value={item.id} mono />
                </dl>

                {Array.isArray(item.metadata.warnings) && (item.metadata.warnings as string[]).length > 0 ? (
                  <ul className="mt-3 space-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
                    {(item.metadata.warnings as string[]).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}

                {item.ref ? (
                  <a
                    href={item.ref}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 transition hover:text-blue-300"
                  >
                    Open the source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right text-gray-300 ${mono ? "font-mono text-[10px]" : ""}`}>{value}</dd>
    </div>
  );
}
