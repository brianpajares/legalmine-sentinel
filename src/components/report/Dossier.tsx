import Link from "next/link";

import type { Assessment, Project } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";
import AoiSketch from "./AoiSketch";
import PrintButton from "./PrintButton";
import { formatHectares, formatTimestamp, STATUS_LABELS, TIER_LABELS } from "@/lib/ui/format";
import { headline } from "@/lib/scoring/engine";

/**
 * Preliminary due-diligence dossier (Plan Maestro §10).
 *
 * Every line on this page is read from the persisted assessment. There is no
 * hard-coded holder, identifier, status, coordinate or observation anywhere in
 * this component — if a fact is not in the assessment, the report says it was
 * not verified.
 */

const OVERLAY_COLORS: Record<string, string> = {
  ingemmet: "#3b82f6",
  sernanp: "#10b981",
};

export default function Dossier({
  assessment,
  project,
}: {
  assessment: Assessment;
  project: Project | null;
}) {
  const findings = (key: string) =>
    assessment.evidence.filter((e) => e.sourceKey === key && e.kind === "finding");

  const overlays = assessment.evidence
    .filter((e) => e.geometry && OVERLAY_COLORS[e.sourceKey])
    .map((e) => ({
      geometry: e.geometry!,
      color: OVERLAY_COLORS[e.sourceKey],
      label: e.sourceKey,
    }));

  const topFlags = [...assessment.factors]
    .filter((f) => !f.inconclusive && f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  return (
    <article className="mx-auto max-w-4xl px-5 py-8 text-gray-200 print-surface">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href="/app" className="text-xs font-semibold text-blue-400 hover:text-blue-300">
          ← Back to the workspace
        </Link>
        <PrintButton assessmentId={assessment.id} />
      </nav>

      {assessment.demoMode ? (
        <p className="mb-6 rounded-lg border border-fuchsia-400/60 bg-fuchsia-500/15 px-4 py-3 text-xs font-semibold text-fuchsia-100 print-surface">
          DEMONSTRATION DOSSIER — every record below is fictional fixture data. No government service
          was queried for this assessment.
        </p>
      ) : null}

      {/* Cover */}
      <header className="border-b border-white/15 pb-6 print-break">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-400">
          LegalMine Sentinel
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
          Preliminary mining due-diligence screening
        </h1>
        <p className="mt-1 text-lg font-semibold text-gray-300">{assessment.projectName}</p>

        <dl className="mt-5 grid gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
          <Meta label="Assessment ID" value={assessment.id} mono />
          <Meta label="Rule version" value={assessment.ruleVersion} mono />
          <Meta label="Generated" value={formatTimestamp(assessment.createdAt)} />
          <Meta label="Assessment status" value={assessment.status} />
          <Meta label="Geometry hash" value={assessment.geometrySummary.geometryHash} mono />
          <Meta label="Country" value={project?.country ?? "—"} />
          <Meta
            label="Evidence basis"
            value={
              assessment.basisMode === "corpus"
                ? `Monthly snapshot — ${assessment.corpusBasis.map((b) => b.period).join(", ")}`
                : "Live query at assessment time"
            }
          />
        </dl>

        {assessment.corpusBasis.length > 0 ? (
          <div className="mt-5 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-3 print-surface">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
              Reproducibility basis
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              This assessment was computed against dated snapshots of the official layers. Re-running
              it against the same snapshots reproduces this result exactly, for as long as they are
              retained — the finding does not drift when the source is later edited.
            </p>
            <table className="mt-3 w-full text-left text-[10px]">
              <thead className="text-gray-500">
                <tr>
                  <th className="pb-1 font-semibold">Source</th>
                  <th className="pb-1 font-semibold">Period</th>
                  <th className="pb-1 font-semibold">Records</th>
                  <th className="pb-1 font-semibold">Snapshot checksum</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {assessment.corpusBasis.map((basis) => (
                  <tr key={basis.snapshotId} className="border-t border-white/10">
                    <td className="py-1 pr-3">{basis.sourceKey}</td>
                    <td className="py-1 pr-3">{basis.period}</td>
                    <td className="py-1 pr-3">{basis.recordCount.toLocaleString()}</td>
                    <td className="py-1 font-mono">{basis.checksum ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[11px] leading-relaxed text-amber-200 print-surface">
          <strong className="font-bold">Preliminary screening — not legal advice.</strong> This report
          combines official and referenced datasets to flag issues that merit further investigation. It
          does not establish legality, title, viability or compliance, and it does not replace review
          by qualified legal, environmental or land professionals. Cadastral and geospatial data
          published by government bodies is referential and must be confirmed against the official
          file before any transaction.
        </p>
      </header>

      <Section number={1} title="Executive summary">
        <p className="text-sm leading-relaxed text-gray-300">{headline(assessment)}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stat
            label="Overall screening risk"
            value={assessment.riskLevel === "NOT_ASSESSED" ? "—" : `${assessment.overallRisk}/100`}
            sub={assessment.riskLevel === "NOT_ASSESSED" ? "NOT ASSESSED" : assessment.riskLevel}
          />
          <Stat label="Data confidence" value={`${assessment.confidence}/100`} sub={assessment.confidenceLevel} />
        </div>

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-gray-400">
          Top findings by contribution
        </h3>
        {topFlags.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 print-muted">
            No factor produced a positive contribution to the score in this assessment.
          </p>
        ) : (
          <ol className="mt-2 space-y-2">
            {topFlags.map((factor) => (
              <li key={factor.factorKey} className="text-xs leading-relaxed text-gray-300">
                <strong className="font-semibold text-white">
                  {factor.label} (+{factor.contribution} points, rule {factor.ruleId})
                </strong>
                <br />
                {factor.rationale}
              </li>
            ))}
          </ol>
        )}

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-gray-400">
          Top open checks
        </h3>
        {assessment.missingChecks.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 print-muted">
            Every configured check was evaluated with live data.
          </p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {assessment.missingChecks.slice(0, 3).map((check) => (
              <li key={check.key} className="text-xs leading-relaxed text-gray-300">
                <strong className="font-semibold text-white">{check.label}</strong> — {check.reason}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section number={2} title="Scope & geometry">
        <dl className="grid gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
          <Meta label="Area" value={formatHectares(assessment.geometrySummary.areaHectares)} />
          <Meta label="Input format" value={assessment.geometrySummary.format.toUpperCase()} />
          <Meta label="Vertices" value={String(assessment.geometrySummary.vertexCount)} />
          <Meta
            label="Centroid (lat, lon)"
            value={`${assessment.geometrySummary.centroid[1]}, ${assessment.geometrySummary.centroid[0]}`}
            mono
          />
          <Meta label="Bounding box" value={assessment.geometrySummary.bbox.join(", ")} mono />
          <Meta label="CRS" value="WGS84 / EPSG:4326" />
        </dl>

        {project ? (
          <div className="mt-5">
            <AoiSketch aoi={project.geometry} overlays={overlays} />
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-500 print-muted">
            The project geometry is not available in this deployment&apos;s storage, so the outline
            could not be redrawn. The geometry hash above still identifies the assessed area.
          </p>
        )}
      </Section>

      <Section number={3} title="Data sources">
        <table className="w-full text-left text-[11px]">
          <thead className="border-b border-white/15 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-semibold">Source</th>
              <th className="py-2 pr-3 font-semibold">Type</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Queried</th>
              <th className="py-2 font-semibold">Records</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {assessment.sourceStatus.map((source) => (
              <tr key={source.sourceKey} className="align-top">
                <td className="py-2 pr-3 font-semibold text-gray-200">{source.sourceName}</td>
                <td className="py-2 pr-3 text-gray-400 print-muted">
                  {source.official ? "Official" : "Non-official"}
                </td>
                <td className="py-2 pr-3 text-gray-300">{STATUS_LABELS[source.status]}</td>
                <td className="py-2 pr-3 text-gray-400 print-muted">
                  {formatTimestamp(source.fetchedAt)}
                </td>
                <td className="py-2 text-gray-300">{source.recordCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="mt-4 space-y-1.5 text-[10px] leading-relaxed text-gray-500 print-muted">
          {assessment.sourceStatus.flatMap((source) =>
            source.warnings.map((warning) => (
              <li key={`${source.sourceKey}-${warning}`}>
                <strong className="text-gray-400">{source.sourceName}:</strong> {warning}
              </li>
            )),
          )}
        </ul>
      </Section>

      <Section number={4} title="Mining rights screening">
        <EvidenceList
          items={findings("ingemmet")}
          emptyMessage="The mining cadastre returned no intersecting record, or it could not be queried for this assessment. See the source table above for which of the two applies."
        />
      </Section>

      <Section number={5} title="Environmental screening">
        <EvidenceList
          items={findings("sernanp")}
          emptyMessage="No intersecting protected area was returned, or the protected-area service could not be queried. See the source table above."
        />
      </Section>

      <Section number={6} title="Territorial & water context">
        <p className="text-xs leading-relaxed text-gray-400 print-muted">
          {assessment.missingChecks.some((c) => c.key === "territorial_context" || c.key === "water_context")
            ? "Territorial and water-resource layers were not evaluated in this assessment. The specific gaps and the actions that would close them are listed in section 9."
            : "See the evidence records below."}
        </p>
        <EvidenceList items={[...findings("bdpi"), ...findings("ana")]} emptyMessage="" />
      </Section>

      <Section number={7} title="Satellite change evidence">
        <EvidenceList
          items={findings("copernicus")}
          emptyMessage="No satellite scene was catalogued for this assessment. No substitute or illustrative imagery is generated: when the catalogue is unavailable or returns too few usable scenes, this section stays empty."
        />
        <p className="mt-3 text-[10px] leading-relaxed text-gray-500 print-muted">
          This version reports scene metadata only. It does not compute a vegetation index and derives
          no conclusion about activity on the ground from imagery.
        </p>
      </Section>

      <Section number={8} title="Risk breakdown">
        <table className="w-full text-left text-[11px]">
          <thead className="border-b border-white/15 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-semibold">Factor</th>
              <th className="py-2 pr-3 font-semibold">Rule</th>
              <th className="py-2 pr-3 font-semibold">Severity</th>
              <th className="py-2 pr-3 font-semibold">Contribution</th>
              <th className="py-2 font-semibold">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {assessment.factors.map((factor) => (
              <tr key={factor.factorKey} className="align-top">
                <td className="py-2 pr-3 font-semibold text-gray-200">{factor.label}</td>
                <td className="py-2 pr-3 font-mono text-[10px] text-gray-400 print-muted">
                  {factor.ruleId}
                </td>
                <td className="py-2 pr-3 text-gray-300">
                  {factor.inconclusive ? "Inconclusive" : `${factor.factorScore}/100`}
                </td>
                <td className="py-2 pr-3 text-gray-300">
                  {factor.inconclusive ? "—" : `+${factor.contribution}`}
                </td>
                <td className="py-2 font-mono text-[9px] text-gray-500 print-muted">
                  {factor.evidenceIds.join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-gray-400">Dimensions</h3>
        <table className="mt-2 w-full text-left text-[11px]">
          <thead className="border-b border-white/15 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-semibold">Dimension</th>
              <th className="py-2 pr-3 font-semibold">Configured weight</th>
              <th className="py-2 pr-3 font-semibold">Applied weight</th>
              <th className="py-2 pr-3 font-semibold">Score</th>
              <th className="py-2 font-semibold">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {assessment.dimensions.map((dimension) => (
              <tr key={dimension.key}>
                <td className="py-2 pr-3 font-semibold text-gray-200">{dimension.label}</td>
                <td className="py-2 pr-3 text-gray-400 print-muted">
                  {Math.round(dimension.weight * 100)}%
                </td>
                <td className="py-2 pr-3 text-gray-400 print-muted">
                  {dimension.inconclusive ? "excluded" : `${Math.round(dimension.effectiveWeight * 100)}%`}
                </td>
                <td className="py-2 pr-3 text-gray-300">
                  {dimension.inconclusive ? "—" : `${dimension.score}/100`}
                </td>
                <td className="py-2 text-gray-300">
                  {dimension.inconclusive ? "—" : `+${dimension.contribution}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[10px] leading-relaxed text-gray-500 print-muted">
          Dimensions that could not be evaluated are excluded from the overall score and their weight
          is redistributed proportionally across the remaining dimensions. Data confidence absorbs the
          loss instead.
        </p>
      </Section>

      <Section number={9} title="Due-diligence gaps">
        {assessment.missingChecks.length === 0 ? (
          <p className="text-xs text-gray-400 print-muted">
            Every configured check was evaluated with live data for this assessment.
          </p>
        ) : (
          <ol className="space-y-3">
            {assessment.missingChecks.map((check) => (
              <li key={check.key} className="print-break">
                <p className="text-xs font-bold text-white">{check.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400 print-muted">
                  {check.reason}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400 print-muted">
                  <strong className="text-gray-300">Conclusion blocked:</strong> {check.blockedConclusion}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400 print-muted">
                  <strong className="text-gray-300">Action:</strong> {check.suggestedAction}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section number={10} title="Recommended next steps">
        <ol className="space-y-2 text-xs leading-relaxed text-gray-300">
          <li>
            1. Close the gaps in section 9 before this screening informs a commitment; each one names
            the conclusion it currently blocks.
          </li>
          {assessment.factors
            .filter((f) => !f.inconclusive && f.nextStep)
            .map((factor) => (
              <li key={factor.factorKey}>
                • <strong className="font-semibold text-white">{factor.label}:</strong> {factor.nextStep}
              </li>
            ))}
          <li>
            • Re-run this assessment before a decision point. Source data changes, and a new run
            produces a new assessment ID rather than overwriting this one.
          </li>
          <li>
            • Have qualified legal, environmental and land professionals review any finding that would
            change a commercial position.
          </li>
        </ol>
      </Section>

      <Section number={11} title="Appendix — evidence register">
        <table className="w-full text-left text-[10px]">
          <thead className="border-b border-white/15 uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-semibold">Evidence ID</th>
              <th className="py-2 pr-3 font-semibold">Source</th>
              <th className="py-2 pr-3 font-semibold">Tier</th>
              <th className="py-2 pr-3 font-semibold">Queried</th>
              <th className="py-2 font-semibold">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {assessment.evidence.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="py-1.5 pr-3 font-mono text-gray-400 print-muted">{item.id}</td>
                <td className="py-1.5 pr-3 text-gray-300">{item.sourceName}</td>
                <td className="py-1.5 pr-3 text-gray-400 print-muted">{TIER_LABELS[item.tier]}</td>
                <td className="py-1.5 pr-3 text-gray-400 print-muted">
                  {formatTimestamp(item.fetchedAt)}
                </td>
                <td className="py-1.5 break-all text-gray-500 print-muted">{item.ref ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <footer className="mt-10 border-t border-white/15 pt-4 text-[10px] leading-relaxed text-gray-500 print-muted">
        <p>
          LegalMine Sentinel · Assessment {assessment.id} · Rule version {assessment.ruleVersion} ·
          Generated {formatTimestamp(assessment.createdAt)}
        </p>
        <p className="mt-1">
          Preliminary screening based on official and referenced data sources. Not legal advice. This
          document reproduces the evidence as it stood when the assessment ran; sources are not
          re-queried when it is reopened.
        </p>
      </footer>
    </article>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 print-break">
      <h2 className="mb-3 border-b border-white/10 pb-2 text-sm font-bold uppercase tracking-wider text-white">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-semibold text-gray-500 print-muted">{label}:</dt>
      <dd className={`break-all text-gray-300 ${mono ? "font-mono text-[10px]" : ""}`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-white/15 px-4 py-3 print-surface">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 print-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold text-white">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 print-muted">{sub}</p>
    </div>
  );
}

function EvidenceList({ items, emptyMessage }: { items: Evidence[]; emptyMessage: string }) {
  if (items.length === 0) {
    return emptyMessage ? (
      <p className="text-xs leading-relaxed text-gray-500 print-muted">{emptyMessage}</p>
    ) : null;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="print-break">
          <p className="text-xs font-bold text-white">
            {item.title}{" "}
            <span className="font-mono text-[9px] font-normal text-gray-500">({item.id})</span>
          </p>
          {item.detail ? (
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400 print-muted">{item.detail}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-gray-500 print-muted">
            {item.sourceName} · {TIER_LABELS[item.tier]} · queried {formatTimestamp(item.fetchedAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
