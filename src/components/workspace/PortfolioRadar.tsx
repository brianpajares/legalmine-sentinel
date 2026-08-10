"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Assessment } from "@/types/assessment";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/Primitives";
import { formatTimestamp, opportunityScore, RISK_STYLES } from "@/lib/ui/format";

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
 * Ranks assessments already run in this deployment by how much they justify a
 * closer look: low screening risk carries weight only when data confidence
 * supports it. The score is derived from stored assessments — there is no
 * per-asset table of hand-set values behind it, and it never claims that an
 * area is legally viable or available.
 */
export default function PortfolioRadar() {
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

  const ranked = (rows ?? [])
    .map((row) => ({
      row,
      score: opportunityScore(row as Assessment),
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <Panel className="p-5">
      <PanelHeader
        title="Opportunity screening radar"
        subtitle="Assessments ranked by low screening risk backed by solid data confidence. A high score means the area deserves a closer look — not that it is available or viable."
      />

      {failed ? (
        <p className="mt-4 text-xs text-gray-500">Assessment history could not be loaded.</p>
      ) : rows === null ? (
        <p className="mt-4 text-xs text-gray-500">Loading…</p>
      ) : ranked.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No assessments yet"
            detail="Run a screening and it will appear here. This list only ever shows assessments that exist in this deployment."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-gray-500">
              <tr className="border-b border-white/10">
                <th className="py-2 font-semibold">Project</th>
                <th className="py-2 font-semibold">Screening opportunity</th>
                <th className="py-2 font-semibold">Risk</th>
                <th className="py-2 font-semibold">Confidence</th>
                <th className="py-2 font-semibold">Run at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ranked.map(({ row, score }) => {
                const style = RISK_STYLES[row.riskLevel];
                return (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/report/${row.id}`}
                        className="font-semibold text-gray-200 underline-offset-2 hover:text-white hover:underline"
                      >
                        {row.projectName}
                      </Link>
                      {row.demoMode ? (
                        <span className="ml-2 rounded border border-fuchsia-400/50 bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-200">
                          DEMO
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 font-bold text-white">{score}</td>
                    <td className={`py-2.5 pr-3 font-semibold ${style.text}`}>
                      {row.overallRisk} · {row.riskLevel}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400">
                      {row.confidence} · {row.confidenceLevel}
                    </td>
                    <td className="py-2.5 text-gray-500">{formatTimestamp(row.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
