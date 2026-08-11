"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
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
import StorageBadge from "./StorageBadge";
import ScreeningProgress from "./ScreeningProgress";
import { track } from "@/lib/analytics/client";
import { saveReportFallback } from "@/components/report/ClientReportFallback";
import {
  getLanguageSnapshot,
  getServerLanguageSnapshot,
  setLanguage,
  subscribeLanguage,
  WORKSPACE_COPY,
  type Language,
  type WorkspaceCopy,
} from "@/lib/i18n/workspace";

type Tab = "risk" | "sources" | "map" | "gaps" | "portfolio" | "feedback";

const TAB_ORDER: { id: Tab; icon: typeof ShieldAlert }[] = [
  { id: "risk", icon: ShieldAlert },
  { id: "sources", icon: Database },
  { id: "map", icon: Layers },
  { id: "gaps", icon: AlertTriangle },
  { id: "portfolio", icon: Compass },
  { id: "feedback", icon: MessageSquare },
];

export default function Workspace({ demoMode }: { demoMode: boolean }) {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getServerLanguageSnapshot,
  );
  const [project, setProject] = useState<Project | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("risk");
  const [drawer, setDrawer] = useState<Evidence[] | null>(null);

  const copy = useMemo(() => WORKSPACE_COPY[language], [language]);

  async function runAssessment(target: Project) {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: target.id, projectSnapshot: target }),
      });
      const payload = (await response.json()) as {
        assessment?: Assessment;
        error?: string;
        detail?: string;
      };
      if (!response.ok || !payload.assessment) {
        setError(
          [payload.error, payload.detail].filter(Boolean).join(" ") ||
            "No se pudo completar el análisis.",
        );
        return;
      }
      saveReportFallback(payload.assessment, target);
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
      setError(caught instanceof Error ? caught.message : "Error de red.");
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

  const activeTab = copy.tabs[tab];

  return (
    <div className="min-h-screen bg-[#080b14]">
      <TopBar
        copy={copy}
        language={language}
        onLanguageChange={setLanguage}
        onReset={reset}
        hasProject={Boolean(project)}
      />

      <main className="mx-auto max-w-[1400px] px-5 py-7">
        {!project ? (
          <CreateAssessment demoMode={demoMode} onProjectReady={handleProjectReady} busy={running} />
        ) : (
          <div className="space-y-5">
            <ProjectHeader
              copy={copy}
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

            {running && !assessment ? <ScreeningProgress copy={copy} /> : null}

            {assessment ? (
              // Sidebar layout: six destinations do not fit legibly in a
              // horizontal strip, and a vertical rail leaves room to say what
              // each view answers before the operator commits to a click.
              <div className="grid gap-5 lg:grid-cols-[236px_minmax(0,1fr)]">
                <nav className="lg:sticky lg:top-[76px] lg:self-start">
                  <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                    {copy.nav.sectionLabel}
                  </p>
                  <ul className="space-y-1">
                    {TAB_ORDER.map(({ id, icon: Icon }) => {
                      const item = copy.tabs[id];
                      const active = tab === id;
                      const badge =
                        id === "gaps" && assessment.missingChecks.length > 0
                          ? assessment.missingChecks.length
                          : null;
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => setTab(id)}
                            aria-current={active ? "page" : undefined}
                            className={`group w-full rounded-xl border px-3 py-2.5 text-left transition ${
                              active
                                ? "border-blue-500/40 bg-blue-600/15"
                                : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon
                                className={`h-3.5 w-3.5 flex-none ${
                                  active ? "text-blue-300" : "text-gray-500 group-hover:text-gray-300"
                                }`}
                              />
                              <span
                                className={`flex-1 text-xs font-semibold ${
                                  active ? "text-blue-100" : "text-gray-300"
                                }`}
                              >
                                {item.label}
                              </span>
                              {badge !== null ? (
                                <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">
                                  {badge}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`mt-1 block pl-[22px] text-[10.5px] leading-snug ${
                                active ? "text-blue-200/70" : "text-gray-600"
                              }`}
                            >
                              {item.purpose}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <section className="min-w-0 space-y-4">
                  {/* Guidance sits above every panel: the staff using this daily
                      should never have to guess what they are looking at. */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <h2 className="text-sm font-bold text-white">{activeTab.label}</h2>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-gray-400">
                      {activeTab.guidance}
                    </p>
                  </div>

                  {tab === "risk" ? (
                    <RiskExplorer
                      assessment={assessment}
                      onOpenEvidence={(items) => setDrawer(items)}
                    />
                  ) : null}
                  {tab === "sources" ? <SourceCheck sources={assessment.sourceStatus} /> : null}
                  {tab === "gaps" ? <MissingData assessment={assessment} /> : null}
                  {tab === "portfolio" ? (
                    <PortfolioRadar
                      currentAssessment={assessment}
                      project={project}
                      onSelectEvidence={(item) => setDrawer([item])}
                    />
                  ) : null}
                  {tab === "feedback" ? (
                    <FeedbackForm assessmentId={assessment.id} projectId={assessment.projectId} />
                  ) : null}
                  {tab === "map" ? (
                    <div className="h-[640px]">
                      <MapPanel
                        aoi={project.geometry}
                        evidence={assessment.evidence}
                        sources={assessment.sourceStatus}
                        center={assessment.geometrySummary.centroid}
                        onSelectEvidence={(item) => setDrawer([item])}
                      />
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </div>
        )}
      </main>

      <EvidenceDrawer evidence={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function TopBar({
  copy,
  language,
  onLanguageChange,
  onReset,
  hasProject,
}: {
  copy: WorkspaceCopy;
  language: Language;
  onLanguageChange: (next: Language) => void;
  onReset: () => void;
  hasProject: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080b14]/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <ShieldAlert className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-bold uppercase tracking-wider text-white">
            LegalMine <span className="text-blue-400">Sentinel</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <StorageBadge copy={copy} />
          <div className="flex overflow-hidden rounded-lg border border-white/15">
            {(["es", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLanguageChange(code)}
                aria-pressed={language === code}
                className={`px-2 py-1 text-[10px] font-bold uppercase transition ${
                  language === code
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          {hasProject ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
            >
              <Plus className="h-3.5 w-3.5" />
              {copy.nav.newAssessment}
            </button>
          ) : null}
          <Link
            href="/pricing"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-400 transition hover:text-white"
          >
            {copy.nav.pricing}
          </Link>
        </div>
      </div>
    </header>
  );
}

function ProjectHeader({
  copy,
  project,
  assessment,
  running,
  warnings,
  onRerun,
}: {
  copy: WorkspaceCopy;
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
            {project.geometrySummary.areaHectares.toLocaleString("es-PE")} {copy.header.areaLabel} ·{" "}
            {project.geometrySummary.format.toUpperCase()} {copy.header.inputLabel} ·{" "}
            {copy.header.geometryLabel}{" "}
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
                title={copy.header.reportHint}
                onClick={() => {
                  saveReportFallback(assessment, project);
                  track("report_generated", { assessment_id: assessment.id });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                <FileText className="h-3.5 w-3.5" />
                {copy.header.viewReport}
              </Link>
            </>
          ) : null}
          <button
            type="button"
            onClick={onRerun}
            disabled={running}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5 disabled:opacity-60"
          >
            {running ? copy.header.running : copy.header.rerun}
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
          <strong className="font-semibold">Análisis parcial.</strong> Al menos una fuente primaria
          no respondió, así que este resultado cubre menos verificaciones que un tamizaje completo.
          Revisa <em>Estado de fuentes</em> y <em>No verificado</em> antes de concluir.
        </p>
      ) : null}
    </Panel>
  );
}
