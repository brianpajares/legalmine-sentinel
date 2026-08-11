import type { Assessment, DimensionResult, RiskFactorResult } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";

/**
 * Self-contained HTML dossier.
 *
 * Written as a plain string template rather than SSR of the React component, so
 * it can be uploaded to Google Drive as a stand-alone file that opens directly
 * in a browser — no React, no CSS bundle, no external assets. Every style is
 * inlined so the document looks the same whether it is served from this app,
 * previewed inside Drive, printed, or saved to disk.
 *
 * The content matches what the React Dossier prints on paper: same evidence
 * table, same reproducibility basis, same statement of what is and is not
 * assessed. The Drive copy is not a summary or a marketing artefact — it is
 * the same finding, stored where the customer can find it later.
 */

const RISK_LABELS: Record<Assessment["riskLevel"], string> = {
  NOT_ASSESSED: "No evaluado",
  LOW: "Bajo",
  MODERATE: "Moderado",
  HIGH: "Alto",
  CRITICAL: "Crítico",
};

const CONFIDENCE_LABELS: Record<Assessment["confidenceLevel"], string> = {
  LOW: "Confianza baja",
  MEDIUM: "Confianza media",
  HIGH: "Confianza alta",
};

const STATUS_LABELS: Record<string, string> = {
  OK: "Fuente respondió",
  STALE: "Fuente respondió, dato antiguo",
  MANUAL_VERIFICATION_REQUIRED: "Verificación manual requerida",
  NOT_CONFIGURED: "Fuente no configurada",
  UNAVAILABLE: "Fuente no disponible",
};

function escape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function fmtTimestamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return escape(iso);
  return new Date(parsed).toLocaleString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function dossierFilename(assessment: Assessment, projectName: string): string {
  const project = slug(projectName) || "aoi";
  const date = assessment.createdAt.slice(0, 10);
  return `dossier-${date}-${project}-${assessment.id.slice(0, 12)}.html`;
}

function factorRow(factor: RiskFactorResult, evidenceById: Map<string, Evidence>): string {
  const refs = factor.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((entry): entry is Evidence => Boolean(entry))
    .slice(0, 4);

  return `
    <tr>
      <td>${escape(factor.label)}</td>
      <td class="num">${fmtNumber(factor.contribution, 1)}</td>
      <td class="num">${fmtNumber(factor.factorScore, 0)}</td>
      <td>${escape(STATUS_LABELS[factor.dataStatus] ?? factor.dataStatus)}</td>
      <td>
        ${escape(factor.rationale)}
        ${refs.length > 0
          ? `<div class="refs">${refs
              .map((entry) => `<span>${escape(entry.sourceName)}</span>`)
              .join(" · ")}</div>`
          : ""}
      </td>
    </tr>`;
}

function dimensionRow(dimension: DimensionResult): string {
  return `
    <tr>
      <td>${escape(dimension.label)}</td>
      <td class="num">${fmtNumber(dimension.effectiveWeight * 100, 1)}%</td>
      <td class="num">${fmtNumber(dimension.score, 0)}</td>
      <td class="num">${fmtNumber(dimension.contribution, 1)}</td>
      <td>${dimension.inconclusive ? "No pudo evaluarse" : "Evaluada"}</td>
    </tr>`;
}

function evidenceCard(entry: Evidence): string {
  const status = STATUS_LABELS[entry.status] ?? entry.status;
  const link = entry.ref
    ? `<a href="${escape(entry.ref)}" target="_blank" rel="noopener">Portal oficial</a>`
    : "";
  return `
    <article>
      <header>
        <span class="tag ${entry.official ? "tag-official" : ""}">${escape(entry.sourceName)}</span>
        <span class="meta">Consultado ${fmtTimestamp(entry.fetchedAt)} · ${escape(status)}</span>
      </header>
      <h4>${escape(entry.title)}</h4>
      ${entry.detail ? `<p>${escape(entry.detail)}</p>` : ""}
      ${link ? `<p class="link">${link}</p>` : ""}
    </article>`;
}

export interface RenderContext {
  assessment: Assessment;
  projectName: string;
  projectCountry?: string;
}

/**
 * Renders an assessment as a self-contained HTML document, styled to match the
 * in-app dossier and safe to store and re-open independently.
 */
export function renderDossierHtml({ assessment, projectName, projectCountry }: RenderContext): string {
  const evidenceById = new Map(assessment.evidence.map((entry) => [entry.id, entry]));
  const findings = assessment.evidence.filter((entry) => entry.kind === "finding");

  const risk = RISK_LABELS[assessment.riskLevel];
  const confidence = CONFIDENCE_LABELS[assessment.confidenceLevel];
  const basisLabel =
    assessment.basisMode === "corpus"
      ? `Snapshot mensual — ${assessment.corpusBasis
          .map((basis) => basis.period)
          .join(", ") || "sin período"}`
      : "Consulta en vivo al momento de la evaluación";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dossier — ${escape(projectName)}</title>
<style>
  :root {
    color-scheme: light;
    --ground: #f6f7f5;
    --panel: #ffffff;
    --ink: #0f1512;
    --ink-2: #37423d;
    --muted: #6a746e;
    --rule: #d8dcd4;
    --rule-soft: #e6e8e2;
    --accent: #0e6a4e;
    --accent-soft: #e0efe7;
    --warn: #a9542b;
    --warn-soft: #f3e2d5;
    --display: Georgia, "Iowan Old Style", "Times New Roman", serif;
    --body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: var(--body);
    font-size: 14px;
    line-height: 1.55;
  }
  .sheet { max-width: 62rem; margin: 0 auto; padding: 3rem 2rem 4rem; }
  header.masthead {
    border-bottom: 2px solid var(--ink);
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
    display: grid;
    gap: 0.75rem;
  }
  .wordmark {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--accent);
  }
  h1 {
    font-family: var(--display);
    font-size: 1.9rem;
    line-height: 1.15;
    letter-spacing: -0.015em;
    margin: 0;
  }
  h2 {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
    margin: 0 0 0.9rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--rule);
  }
  h3 {
    font-family: var(--display);
    font-size: 1.05rem;
    margin: 0;
  }
  section { margin-top: 1.9rem; }
  p { margin: 0; color: var(--ink-2); }
  strong { color: var(--ink); font-weight: 650; }
  .lede { color: var(--ink); font-size: 1.02rem; }
  dl.meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem 1.5rem;
    margin: 0;
  }
  dl.meta dt {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.15rem;
  }
  dl.meta dd { margin: 0; font-size: 0.95rem; }
  .verdict {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1px;
    background: var(--rule);
    border: 1px solid var(--rule);
    margin-top: 1rem;
  }
  @media (min-width: 640px) { .verdict { grid-template-columns: 1fr 1fr 1fr; } }
  .verdict > div { background: var(--panel); padding: 1rem 1.15rem; }
  .verdict span {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 0.35rem;
  }
  .verdict .value {
    font-family: var(--display);
    font-size: 1.55rem; line-height: 1.1; letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
  }
  .verdict p { font-size: 0.85rem; margin-top: 0.5rem; }
  .callout {
    border-left: 3px solid var(--accent);
    background: var(--accent-soft);
    padding: 0.85rem 1.15rem;
    margin-top: 1.2rem;
  }
  .callout p { color: var(--ink); max-width: 62ch; }
  .callout.warn { border-left-color: var(--warn); background: var(--warn-soft); }
  .scroll-x { overflow-x: auto; }
  table {
    border-collapse: collapse; width: 100%; margin-top: 0.8rem;
    font-size: 0.88rem; font-variant-numeric: tabular-nums;
  }
  th, td {
    text-align: left; padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--rule-soft); vertical-align: top;
  }
  th {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--muted); border-bottom-color: var(--rule);
    font-weight: 600;
  }
  td:first-child { color: var(--ink); font-weight: 600; }
  .num { font-family: var(--mono); }
  .refs {
    margin-top: 0.35rem; font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.04em; color: var(--muted);
  }
  .evidence {
    display: grid; gap: 0.85rem; margin-top: 0.8rem;
    grid-template-columns: 1fr;
  }
  @media (min-width: 720px) { .evidence { grid-template-columns: 1fr 1fr; } }
  .evidence article {
    background: var(--panel); border: 1px solid var(--rule-soft);
    padding: 0.9rem 1rem;
  }
  .evidence header {
    display: flex; justify-content: space-between; gap: 0.75rem;
    align-items: baseline; margin-bottom: 0.4rem; flex-wrap: wrap;
  }
  .evidence h4 { margin: 0.2rem 0; font-family: var(--display); font-size: 1rem; }
  .evidence .tag {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--warn);
  }
  .evidence .tag-official { color: var(--accent); }
  .evidence .meta { font-family: var(--mono); font-size: 10px; color: var(--muted); }
  .evidence .link { font-size: 0.85rem; }
  .evidence a { color: var(--accent); text-underline-offset: 3px; }
  .missing { margin-top: 0.9rem; }
  .missing li { margin-bottom: 0.5rem; }
  ul { margin: 0; padding-left: 1.15rem; color: var(--ink-2); }
  footer.small {
    margin-top: 3rem; padding-top: 1rem;
    border-top: 1px solid var(--rule); font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.06em; color: var(--muted);
  }
  @media print {
    body { background: #fff; font-size: 10.5pt; }
    .sheet { padding: 0; max-width: none; }
    section { break-inside: avoid; }
  }
</style>
</head>
<body>
<main class="sheet">
  <header class="masthead">
    <span class="wordmark">LegalMine Sentinel · Dossier</span>
    <h1>${escape(projectName)}</h1>
    <p class="lede">
      Tamizaje preliminar de riesgo legal y territorial. Cada valor cita su fuente.
      Cuando un dato falta, se declara como tal.
    </p>
  </header>

  <section>
    <h2>Ficha del análisis</h2>
    <dl class="meta">
      <div><dt>ID de evaluación</dt><dd>${escape(assessment.id)}</dd></div>
      <div><dt>Generado</dt><dd>${fmtTimestamp(assessment.createdAt)}</dd></div>
      <div><dt>Versión de reglas</dt><dd>${escape(assessment.ruleVersion)}</dd></div>
      <div><dt>Estado</dt><dd>${escape(assessment.status)}</dd></div>
      <div><dt>Base de evidencia</dt><dd>${escape(basisLabel)}</dd></div>
      <div><dt>País</dt><dd>${escape(projectCountry ?? "PE")}</dd></div>
      <div><dt>Área (ha)</dt><dd>${fmtNumber(assessment.geometrySummary.areaHectares, 2)}</dd></div>
      <div><dt>Huella de geometría</dt><dd style="font-family:var(--mono);font-size:10.5px;">${escape(
        assessment.geometrySummary.geometryHash,
      )}</dd></div>
    </dl>
  </section>

  <section>
    <h2>Veredicto</h2>
    <div class="verdict">
      <div>
        <span>Riesgo general</span>
        <div class="value">${escape(risk)}</div>
        <p>${fmtNumber(assessment.overallRisk, 0)}/100 sobre el motor v${escape(assessment.ruleVersion)}.</p>
      </div>
      <div>
        <span>Confianza</span>
        <div class="value">${escape(confidence)}</div>
        <p>${fmtNumber(assessment.confidence, 0)}/100. Refleja completitud, frescura y autoridad de la evidencia.</p>
      </div>
      <div>
        <span>Duración</span>
        <div class="value">${fmtNumber(assessment.durationMs / 1000, 1)} s</div>
        <p>Tiempo de cómputo de la evaluación, sin incluir las descargas de las fuentes.</p>
      </div>
    </div>
    ${
      assessment.confidenceLevel === "LOW"
        ? `<div class="callout warn"><p><strong>Confianza baja.</strong> Este resultado señala hacia dónde mirar, no reemplaza la verificación por un profesional. Los factores con <em>Verificación manual requerida</em> deben resolverse antes de decidir.</p></div>`
        : ""
    }
    ${
      assessment.riskLevel === "NOT_ASSESSED"
        ? `<div class="callout warn"><p><strong>No evaluado.</strong> Ninguna dimensión pudo calcularse con la evidencia disponible. Presentar esto como riesgo bajo sería incorrecto: los factores están inconclusos, no verificados.</p></div>`
        : ""
    }
  </section>

  <section>
    <h2>Dimensiones</h2>
    <div class="scroll-x">
      <table>
        <thead>
          <tr>
            <th>Dimensión</th><th>Peso efectivo</th><th>Score</th><th>Contribución</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>${assessment.dimensions.map(dimensionRow).join("")}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Factores de riesgo</h2>
    <div class="scroll-x">
      <table>
        <thead>
          <tr>
            <th>Factor</th><th>Contribución</th><th>Score</th><th>Evidencia</th><th>Racional</th>
          </tr>
        </thead>
        <tbody>${assessment.factors.map((factor) => factorRow(factor, evidenceById)).join("")}</tbody>
      </table>
    </div>
  </section>

  ${
    assessment.missingChecks.length > 0
      ? `<section>
      <h2>Verificaciones pendientes</h2>
      <ul class="missing">
        ${assessment.missingChecks
          .map(
            (item) => `<li>
              <strong>${escape(item.label)}.</strong> ${escape(item.reason)} — ${escape(
                item.blockedConclusion,
              )} <em>${escape(item.suggestedAction)}</em>
            </li>`,
          )
          .join("")}
      </ul>
    </section>`
      : ""
  }

  ${
    findings.length > 0
      ? `<section>
      <h2>Evidencia</h2>
      <div class="evidence">${findings.map(evidenceCard).join("")}</div>
    </section>`
      : ""
  }

  ${
    assessment.corpusBasis.length > 0
      ? `<section>
      <h2>Base de reproducibilidad</h2>
      <p>Este resultado se calculó sobre snapshots fechados de las capas oficiales. Reejecutar contra los mismos snapshots reproduce este dossier idénticamente.</p>
      <div class="scroll-x">
        <table>
          <thead><tr><th>Fuente</th><th>Período</th><th>Registros</th><th>Checksum</th></tr></thead>
          <tbody>${assessment.corpusBasis
            .map(
              (basis) => `<tr>
                <td>${escape(basis.sourceKey)}</td>
                <td>${escape(basis.period)}</td>
                <td class="num">${basis.recordCount.toLocaleString()}</td>
                <td class="num" style="font-size:10.5px;">${escape(basis.checksum ?? "—")}</td>
              </tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>
    </section>`
      : ""
  }

  <footer class="small">
    <p>LegalMine Sentinel · ${escape(assessment.id)} · v${escape(assessment.ruleVersion)} · ${fmtTimestamp(
    assessment.createdAt,
  )}</p>
    <p>Tamizaje preliminar sobre fuentes oficiales y referenciadas. No establece legalidad, título ni cumplimiento. No constituye asesoría legal ni sustituye la revisión por profesionales calificados.</p>
  </footer>
</main>
</body>
</html>`;
}
