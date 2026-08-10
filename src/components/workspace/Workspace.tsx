"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Compass,
  Database,
  FileText,
  Layers,
  MessageSquare,
  Plus,
  ShieldAlert,
} from "lucide-react";

import type { Assessment, Project } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";
import { Panel, RiskBadge, ConfidenceBadge } from "@/components/ui/Primitives";
import CreateAssessment from "./CreateAssessment";
import RiskExplorer from "./RiskExplorer";
import SourceCheck from "./SourceCheck";
import MissingData from "./MissingData";
import EvidenceDrawer from "./EvidenceDrawer";
import FeedbackForm from "./FeedbackForm";
import PortfolioRadar from "./PortfolioRadar";
import MapPanel from "./MapPanel";
import { track } from "@/lib/analytics/client";

type Tab = "risk" | "sources" | "map" | "gaps" | "feedback" | "portfolio";

const TABS: { id: Tab; label: string; icon: typeof ShieldAlert }[] = [
  { id: "risk", label: "Risk Explorer", icon: ShieldAlert },
  { id: "sources", label: "Source Check", icon: Database },
  { id: "map", label: "Evidence Map", icon: Layers },
  { id: "gaps", label: "Not Verified", icon: AlertTriangle },
  { id: "portfolio", label: "Opportunity Radar", icon: Compass },
  { id: "feedback", label: "Pilot Feedback", icon: MessageSquare },
];

export default function Workspace({ demoMode }: { demoMode: boolean }) {
  const [project, setProject] = useState<Project | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("risk");
  const [drawer, setDrawer] = useState<Evidence[] | null>(null);

  async function runAssessment(target: Project) {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: target.id }),
      });
      const payload = (await response.json()) as {
        assessment?: Assessment;
        error?: string;
        detail?: string;
      };
      if (!response.ok || !payload.assessment) {
        setError([payload.error, payload.detail].filter(Boolean).join(" ") || "The assessment failed.");
        return;
      }
      setAssessment(payload.assessment);
      setTab("risk");
      track("source_check_completed", {
        sources_ok: payload.assessment.sourceStatus.filter((s) => s.status === "OK").length,
        sources_missing: payload.assessment.sourceStatus.filter((s) => s.status !== "OK").length,
      });
      track("assessment_completed", {
        duration_sec: Math.round(payload.assessment.durationMs / 1000),
        risk: payload.assessment.overallRisk,
        confidence: payload.assessment.confidence,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Network error.");
    } finally {
      setRunning(false);
    }
  }

  function handleProjectReady(next: Project, nextWarnings: string[]) {
    setProject(next);
    setWarnings(nextWarnings);
    setAssessment(null);
    void runAssessment(next);
  }

  function reset() {
    setProject(null);
    setAssessment(null);
    setWarnings([]);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-[#070a13]">
      <TopBar onReset={reset} hasProject={Boolean(project)} />

      <main className="mx-auto max-w-6xl px-5 py-8">
        {!project ? (
          <CreateAssessment demoMode={demoMode} onProjectReady={handleProjectReady} busy={running} />
        ) : (
          <div className="space-y-6">
            <ProjectHeader
              project={project}
              assessment={assessment}
              running={running}
              warnings={warnings}
              onRerun={() => void runAssessment(project)}
            />

            {error ? (
              <p className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}

            {running && !assessment ? (
              <Panel className="p-10 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
                <p className="mt-4 text-sm font-semibold text-gray-300">
                  Querying sources and applying the rule set…
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Every connector has its own timeout. Sources that do not answer are reported as
                  unavailable rather than waited on indefinitely.
                </p>
              </Panel>
            ) : null}

            {assessment ? (
              <>
                <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
                  {TABS.map((item) => {
                    const Icon = item.icon;
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "bg-blue-600/20 text-blue-300"
                            : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                        {item.id === "gaps" && assessment.missingChecks.length > 0 ? (
                          <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">
                            {assessment.missingChecks.length}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>

                {tab === "risk" ? (
                  <RiskExplorer assessment={assessment} onOpenEvidence={(items) => setDrawer(items)} />
                ) : null}
                {tab === "sources" ? <SourceCheck sources={assessment.sourceStatus} /> : null}
                {tab === "gaps" ? <MissingData assessment={assessment} /> : null}
                {tab === "portfolio" ? <PortfolioRadar /> : null}
                {tab === "feedback" ? (
                  <FeedbackForm assessmentId={assessment.id} projectId={assessment.projectId} />
                ) : null}
                {tab === "map" ? (
                  <div className="h-[640px]">
                    <MapPanel
                      aoi={project.geometry}
                      evidence={assessment.evidence}
                      center={assessment.geometrySummary.centroid}
                      onSelectEvidence={(item) => setDrawer([item])}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </main>

      <EvidenceDrawer evidence={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function TopBar({ onReset, hasProject }: { onReset: () => void; hasProject: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070a13]/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <ShieldAlert className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-bold uppercase tracking-wider text-white">
            LegalMine <span className="text-blue-400">Sentinel</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {hasProject ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
            >
              <Plus className="h-3.5 w-3.5" />
              New assessment
            </button>
          ) : null}
          <Link
            href="/pricing"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-400 transition hover:text-white"
          >
            Pricing
          </Link>
        </div>
      </div>
    </header>
  );
}

function ProjectHeader({
  project,
  assessment,
  running,
  warnings,
  onRerun,
}: {
  project: Project;
  assessment: Assessment | null;
  running: boolean;
  warnings: string[];
  onRerun: () => void;
}) {
  return (
    <Panel className="p-5" demo={project.demo}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-white">{project.name}</h1>
          <p className="mt-1 text-xs text-gray-500">
            {project.geometrySummary.areaHectares.toLocaleString("en-US")} ha ·{" "}
            {project.geometrySummary.format.toUpperCase()} input · geometry{" "}
            <span className="font-mono">{project.geometrySummary.geometryHash.slice(0, 12)}…</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {assessment ? (
            <>
              <RiskBadge level={assessment.riskLevel} score={assessment.overallRisk} />
              <ConfidenceBadge level={assessment.confidenceLevel} score={assessment.confidence} />
              <Link
                href={`/report/${assessment.id}`}
                onClick={() => track("report_generated", { assessment_id: assessment.id })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                <FileText className="h-3.5 w-3.5" />
                Generate dossier
              </Link>
            </>
          ) : null}
          <button
            type="button"
            onClick={onRerun}
            disabled={running}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5 disabled:opacity-60"
          >
            {running ? "Running…" : "Re-run"}
          </button>
        </div>
      </div>

      {warnings.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] p-3 text-[11px] leading-relaxed text-amber-200">
          {warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : null}

      {assessment?.status === "PARTIAL" ? (
        <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200">
          <strong className="font-semibold">Partial assessment.</strong> At least one primary source
          did not answer, so this result covers fewer checks than a complete screening. See Source
          Check and Not Verified.
        </p>
      ) : null}
    </Panel>
  );
}
