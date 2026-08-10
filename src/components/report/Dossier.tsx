import Link from "next/link";

import type { Assessment, Project } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";
import AoiSketch from "./AoiSketch";
import DownloadReportButton from "./DownloadReportButton";
import PrintButton from "./PrintButton";
import { formatHectares, formatTimestamp, STATUS_LABELS, TIER_LABELS } from "@/lib/ui/format";

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
  bdpi: "#f59e0b",
  ana: "#06b6d4",
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
          ← Volver al panel
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <DownloadReportButton assessmentId={assessment.id} />
          <PrintButton assessmentId={assessment.id} />
        </div>
      </nav>

      {assessment.demoMode ? (
        <p className="mb-6 rounded-lg border border-fuchsia-400/60 bg-fuchsia-500/15 px-4 py-3 text-xs font-semibold text-fuchsia-100 print-surface">
          DOSSIER DE DEMOSTRACION: los registros siguientes son datos ficticios de prueba. No se consulto ningun servicio gubernamental para este analisis.
        </p>
      ) : null}

      {/* Cover */}
      <header className="border-b border-white/15 pb-6 print-break">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-400">
          LegalMine Sentinel
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
          Informe preliminar de tamizaje legal y territorial minero
        </h1>
        <p className="mt-1 text-lg font-semibold text-gray-300">{assessment.projectName}</p>

        <dl className="mt-5 grid gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
          <Meta label="ID del analisis" value={assessment.id} mono />
          <Meta label="Version de reglas" value={assessment.ruleVersion} mono />
          <Meta label="Generado" value={formatTimestamp(assessment.createdAt)} />
          <Meta label="Estado del analisis" value={assessment.status} />
          <Meta label="Huella de geometria" value={assessment.geometrySummary.geometryHash} mono />
          <Meta label="Pais" value={project?.country ?? "—"} />
          <Meta
            label="Base de evidencia"
            value={
              assessment.basisMode === "corpus"
                ? `Snapshot mensual - ${assessment.corpusBasis.map((b) => b.period).join(", ")}`
                : "Consulta en vivo al momento del analisis"
            }
          />
        </dl>

        {assessment.corpusBasis.length > 0 ? (
          <div className="mt-5 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-3 print-surface">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
              Base de reproducibilidad
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              Este analisis fue calculado contra snapshots fechados de capas oficiales. Si se vuelve a ejecutar contra los mismos snapshots, el resultado se reproduce mientras esos archivos se conserven; el hallazgo no cambia cuando la fuente oficial se edita despues.
            </p>
            <table className="mt-3 w-full text-left text-[10px]">
              <thead className="text-gray-500">
                <tr>
                  <th className="pb-1 font-semibold">Fuente</th>
                  <th className="pb-1 font-semibold">Periodo</th>
                  <th className="pb-1 font-semibold">Registros</th>
                  <th className="pb-1 font-semibold">Checksum del snapshot</th>
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
          <strong className="font-bold">Tamizaje preliminar: no constituye asesoria legal.</strong> Este informe combina fuentes oficiales y referenciales para identificar asuntos que requieren investigacion adicional. No establece legalidad, titularidad, viabilidad ni cumplimiento, y no reemplaza la revision de profesionales legales, ambientales o territoriales calificados. La informacion catastral y geoespacial publicada por entidades publicas es referencial y debe confirmarse contra el expediente oficial antes de cualquier transaccion.
        </p>
      </header>

      <Section number={1} title="Resumen ejecutivo">
        <p className="text-sm leading-relaxed text-gray-300">{headlineEs(assessment)}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stat
            label="Riesgo preliminar"
            value={assessment.riskLevel === "NOT_ASSESSED" ? "Sin medir" : `${assessment.overallRisk}/100`}
            sub={riskLabel(assessment.riskLevel)}
          />
          <Stat label="Confianza de datos" value={`${assessment.confidence}/100`} sub={confidenceLabel(assessment.confidenceLevel)} />
        </div>

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-gray-400">
          Hallazgos principales por contribucion
        </h3>
        {topFlags.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 print-muted">
            Ningun factor produjo una contribucion positiva al score en este analisis.
          </p>
        ) : (
          <ol className="mt-2 space-y-2">
            {topFlags.map((factor) => (
              <li key={factor.factorKey} className="text-xs leading-relaxed text-gray-300">
                <strong className="font-semibold text-white">
                  {factor.label} (+{factor.contribution} puntos, regla {factor.ruleId})
                </strong>
                <br />
                {factor.rationale}
              </li>
            ))}
          </ol>
        )}

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-gray-400">
          Verificaciones pendientes principales
        </h3>
        {assessment.missingChecks.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 print-muted">
            Todas las verificaciones configuradas fueron evaluadas con datos en vivo.
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

      <Section number={2} title="Alcance y geometria">
        <dl className="grid gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
          <Meta label="Area" value={formatHectares(assessment.geometrySummary.areaHectares)} />
          <Meta label="Formato de entrada" value={assessment.geometrySummary.format.toUpperCase()} />
          <Meta label="Vertices" value={String(assessment.geometrySummary.vertexCount)} />
          <Meta
            label="Centroide (lat, lon)"
            value={`${assessment.geometrySummary.centroid[1]}, ${assessment.geometrySummary.centroid[0]}`}
            mono
          />
          <Meta label="Caja envolvente" value={assessment.geometrySummary.bbox.join(", ")} mono />
          <Meta label="CRS" value="WGS84 / EPSG:4326" />
        </dl>

        {project ? (
          <div className="mt-5">
            <AoiSketch aoi={project.geometry} overlays={overlays} />
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-500 print-muted">
            La geometria del proyecto no esta disponible en el almacenamiento de este despliegue, por lo que no se pudo redibujar el contorno. La huella de geometria identifica igualmente el area evaluada.
          </p>
        )}
      </Section>

      <Section number={3} title="Fuentes de datos">
        <table className="w-full text-left text-[11px]">
          <thead className="border-b border-white/15 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-semibold">Fuente</th>
              <th className="py-2 pr-3 font-semibold">Tipo</th>
              <th className="py-2 pr-3 font-semibold">Estado</th>
              <th className="py-2 pr-3 font-semibold">Consultado</th>
              <th className="py-2 font-semibold">Registros</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {assessment.sourceStatus.map((source) => (
              <tr key={source.sourceKey} className="align-top">
                <td className="py-2 pr-3 font-semibold text-gray-200">{source.sourceName}</td>
                <td className="py-2 pr-3 text-gray-400 print-muted">
                  {source.official ? "Oficial" : "No oficial"}
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

      <Section number={4} title="Tamizaje de derechos mineros">
        <EvidenceList
          items={findings("ingemmet")}
          emptyMessage="El catastro minero no devolvio registros superpuestos, o no pudo consultarse para este analisis. La tabla de fuentes indica cual caso aplica."
        />
      </Section>

      <Section number={5} title="Tamizaje ambiental">
        <EvidenceList
          items={findings("sernanp")}
          emptyMessage="No se devolvio ningun area natural protegida superpuesta, o el servicio no pudo consultarse. Revisar la tabla de fuentes."
        />
      </Section>

      <Section number={6} title="Verificacion REINFO">
        <div className="mb-4 rounded-lg border border-blue-500/25 bg-blue-500/10 px-4 py-3 print-surface">
          <p className="text-xs font-semibold text-blue-100">Capa espacial oficial + verificacion certificada en portal</p>
          <p className="mt-1 text-[11px] leading-relaxed text-blue-100/80">
            Esta seccion usa la capa espacial REINFO de MINEM publicada via GEOCATMIN para identificar coordenadas REINFO declaradas que intersectan el area de interes. Para un dossier certificado, cada COD_REINFO o RUC debe imprimirse desde el portal REINFO de MINEM y adjuntarse.
          </p>
        </div>
        <EvidenceList
          items={findings("reinfo")}
          emptyMessage="La capa espacial oficial REINFO no devolvio coordenadas declaradas que intersecten el area, o no pudo consultarse. La tabla de fuentes indica cual caso aplica."
        />
      </Section>

      <Section number={7} title="Contexto territorial e hidrico">
        <p className="text-xs leading-relaxed text-gray-400 print-muted">
          {assessment.missingChecks.some((c) => c.key === "territorial_context" || c.key === "water_context")
            ? "Las capas territoriales e hidricas no fueron evaluadas en este analisis. Las brechas especificas y las acciones para cerrarlas estan listadas en la seccion 10."
            : "Ver los registros de evidencia siguientes."}
        </p>
        <EvidenceList items={[...findings("bdpi"), ...findings("ana")]} emptyMessage="" />
      </Section>

      <Section number={8} title="Evidencia satelital">
        <EvidenceList
          items={findings("copernicus")}
          emptyMessage="No se catalogo ninguna escena satelital para este analisis. No se genera imagen sustituta ni ilustrativa: cuando el catalogo no esta disponible o devuelve pocas escenas utiles, esta seccion queda vacia."
        />
        <p className="mt-3 text-[10px] leading-relaxed text-gray-500 print-muted">
          Esta version reporta solo metadatos de escena. No calcula indice de vegetacion ni deriva conclusiones de actividad en terreno a partir de imagenes.
        </p>
      </Section>

      <Section number={9} title="Desglose de riesgo">
        <table className="w-full text-left text-[11px]">
          <thead className="border-b border-white/15 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-semibold">Factor</th>
              <th className="py-2 pr-3 font-semibold">Regla</th>
              <th className="py-2 pr-3 font-semibold">Severidad</th>
              <th className="py-2 pr-3 font-semibold">Contribucion</th>
              <th className="py-2 font-semibold">Evidencia</th>
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
                  {factor.inconclusive ? "Inconcluso" : `${factor.factorScore}/100`}
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

        <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-gray-400">Dimensiones</h3>
        <table className="mt-2 w-full text-left text-[11px]">
          <thead className="border-b border-white/15 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-semibold">Dimension</th>
              <th className="py-2 pr-3 font-semibold">Peso configurado</th>
              <th className="py-2 pr-3 font-semibold">Peso aplicado</th>
              <th className="py-2 pr-3 font-semibold">Score</th>
              <th className="py-2 font-semibold">Puntos</th>
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
                  {dimension.inconclusive ? "excluido" : `${Math.round(dimension.effectiveWeight * 100)}%`}
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
          Las dimensiones que no pudieron evaluarse se excluyen del score total y su peso se
          redistribuye proporcionalmente entre las dimensiones restantes. La perdida se refleja en la
          confianza de datos.
        </p>
      </Section>

      <Section number={10} title="Brechas de debida diligencia">
        {assessment.missingChecks.length === 0 ? (
          <p className="text-xs text-gray-400 print-muted">
            Todas las verificaciones configuradas fueron evaluadas con datos en vivo para este analisis.
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
                  <strong className="text-gray-300">Conclusion bloqueada:</strong> {check.blockedConclusion}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400 print-muted">
                  <strong className="text-gray-300">Accion:</strong> {check.suggestedAction}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section number={11} title="Siguientes pasos recomendados">
        <ol className="space-y-2 text-xs leading-relaxed text-gray-300">
          <li>
            1. Cerrar las brechas de la seccion 10 antes de usar este tamizaje para informar un compromiso; cada una indica la conclusion que actualmente bloquea.
          </li>
          {assessment.factors
            .filter((f) => !f.inconclusive && f.nextStep)
            .map((factor) => (
              <li key={factor.factorKey}>
                • <strong className="font-semibold text-white">{factor.label}:</strong> {factor.nextStep}
              </li>
            ))}
          <li>
            • Reejecutar este analisis antes de un punto de decision. Las fuentes cambian, y una nueva corrida produce un nuevo ID de analisis en lugar de sobrescribir este.
          </li>
          <li>
            • Hacer que profesionales legales, ambientales y territoriales calificados revisen cualquier hallazgo que pueda cambiar una posicion comercial.
          </li>
        </ol>
      </Section>

      <Section number={12} title="Monetizacion y empaquetamiento comercial">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Dossier certificado" value="$199" sub="por informe emitido" />
          <Stat label="Monitoreo" value="$49" sub="por area / mes" />
          <Stat label="Plataforma" value="$299" sub="acceso mensual" />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-gray-400 print-muted">
          El tamizaje se vende una vez; el monitoreo es recurrente. Cada mes el sistema compara los snapshots actuales contra el periodo anterior y reporta si nuevos derechos, cambios en areas protegidas, registros REINFO o cambios de capas de contexto tocan el area vigilada. Un mes sin cambios tambien es un hallazgo reportable: nada cambio en el corpus revisado.
        </p>
      </Section>

      <Section number={13} title="Anexo - registro de evidencia">
        <table className="w-full text-left text-[10px]">
          <thead className="border-b border-white/15 uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-semibold">ID de evidencia</th>
              <th className="py-2 pr-3 font-semibold">Fuente</th>
              <th className="py-2 pr-3 font-semibold">Nivel</th>
              <th className="py-2 pr-3 font-semibold">Consultado</th>
              <th className="py-2 font-semibold">Referencia</th>
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
          LegalMine Sentinel · Analisis {assessment.id} · Version de reglas {assessment.ruleVersion} ·
          Generado {formatTimestamp(assessment.createdAt)}
        </p>
        <p className="mt-1">
          Tamizaje preliminar basado en fuentes oficiales y referenciales. No constituye asesoria
          legal. Este documento reproduce la evidencia tal como estaba cuando se ejecuto el analisis;
          las fuentes no se vuelven a consultar al reabrirlo.
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
            {item.sourceName} · {TIER_LABELS[item.tier]} · consultado {formatTimestamp(item.fetchedAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function headlineEs(assessment: Assessment): string {
  if (assessment.riskLevel === "NOT_ASSESSED") {
    return (
      "No se pudo calcular un riesgo preliminar: ninguna dimension de riesgo pudo evaluarse con las " +
      "fuentes disponibles para este analisis. Un score sin medir refleja ausencia de medicion, no " +
      "ausencia de riesgo."
    );
  }

  const risk = `${riskLabel(assessment.riskLevel).toLowerCase()} (${assessment.overallRisk}/100)`;
  const confidence = `${confidenceLabel(assessment.confidenceLevel).toLowerCase()} (${assessment.confidence}/100)`;
  if (assessment.confidenceLevel === "LOW") {
    return `Riesgo preliminar ${risk}, con ${confidence}. Se requiere verificacion antes de cualquier decision.`;
  }
  return `Riesgo preliminar ${risk}, con ${confidence}.`;
}

function riskLabel(risk: Assessment["riskLevel"]): string {
  const labels: Record<Assessment["riskLevel"], string> = {
    NOT_ASSESSED: "No evaluado",
    LOW: "Bajo",
    MODERATE: "Moderado",
    HIGH: "Alto",
    CRITICAL: "Critico",
  };
  return labels[risk];
}

function confidenceLabel(confidence: Assessment["confidenceLevel"]): string {
  const labels: Record<Assessment["confidenceLevel"], string> = {
    LOW: "Confianza baja",
    MEDIUM: "Confianza media",
    HIGH: "Confianza alta",
  };
  return labels[confidence];
}
