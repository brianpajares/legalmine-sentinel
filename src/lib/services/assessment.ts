import type { Assessment, Project } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";
import { collectEvidence, type EvidenceBundle } from "@/lib/sources/collect";
import { runAssessment } from "@/lib/scoring/engine";
import {
  demoMiningRights,
  demoProtectedAreas,
  demoReinfo,
  demoSatellite,
} from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/sources/config";
import { createHash } from "node:crypto";

export interface CreateAssessmentOptions {
  ruleVersion?: string;
  includeSatellite?: boolean;
  reinfoQuery?: string;
}

function evidenceIdFor(sourceKey: string, discriminator: string): string {
  const digest = createHash("sha256").update(`${sourceKey}::${discriminator}`).digest("hex");
  return `ev_${sourceKey}_${digest.slice(0, 10)}`;
}

/**
 * Demo bundle. Built from the same normalizers as a live run so the engine
 * cannot tell the difference — only the evidence tier does, and the UI keys its
 * watermark off that.
 */
function buildDemoBundle(project: Project): EvidenceBundle {
  const aoi = project.geometry;
  const miningRights = demoMiningRights(aoi);
  const protectedAreas = demoProtectedAreas(aoi);
  const reinfo = demoReinfo();
  const satellite = demoSatellite();

  const evidence: Evidence[] = [];
  const push = (
    sourceKey: string,
    sourceName: string,
    status: Evidence["status"],
    discriminator: string,
    title: string,
    detail: string,
    metadata: Record<string, unknown>,
    geometry?: Evidence["geometry"],
  ) => {
    evidence.push({
      id: evidenceIdFor(sourceKey, discriminator),
      kind: discriminator.startsWith("status:") ? "source_status" : "finding",
      sourceKey,
      sourceName,
      official: false,
      tier: "demo",
      status,
      title,
      detail,
      fetchedAt: new Date().toISOString(),
      metadata: { ...metadata, demo: true },
      geometry: geometry ?? null,
    });
  };

  push(
    "ingemmet",
    miningRights.sourceName,
    miningRights.status,
    "status:mining rights",
    `${miningRights.sourceName} — ${miningRights.records.length} fictional record(s)`,
    "Demonstration data. No government service was queried.",
    { status: miningRights.status, warnings: miningRights.warnings },
  );
  for (const record of miningRights.records) {
    push(
      "ingemmet",
      miningRights.sourceName,
      miningRights.status,
      `right:${record.code}`,
      `Mining right ${record.code} — ${record.name}`,
      `Fictional record. Status as supplied by the fixture: ${record.status}. Overlaps ${record.overlapPercentOfAoi}% of the area of interest.`,
      { ...record, raw: undefined },
      record.geometry,
    );
  }

  push(
    "sernanp",
    protectedAreas.sourceName,
    protectedAreas.status,
    "status:protected areas",
    `${protectedAreas.sourceName} — ${protectedAreas.records.length} fictional record(s)`,
    "Demonstration data. No government service was queried.",
    { status: protectedAreas.status, warnings: protectedAreas.warnings },
  );
  for (const record of protectedAreas.records) {
    push(
      "sernanp",
      protectedAreas.sourceName,
      protectedAreas.status,
      `anp:${record.name}`,
      `Protected area — ${record.name}`,
      `Fictional record. Category: ${record.category}. Intersects ${record.overlapPercentOfAoi}% of the area of interest.`,
      { ...record, raw: undefined },
      record.geometry,
    );
  }

  push(
    "reinfo",
    reinfo.sourceName,
    reinfo.status,
    "status:REINFO registration",
    `${reinfo.sourceName} — manual verification required`,
    reinfo.warnings[0],
    { status: reinfo.status, warnings: reinfo.warnings },
  );
  push(
    "copernicus",
    satellite.sourceName,
    satellite.status,
    "status:satellite scenes",
    `${satellite.sourceName} — not configured`,
    satellite.warnings[0],
    { status: satellite.status, warnings: satellite.warnings },
  );

  return {
    aoi,
    aoiHectares: project.geometrySummary.areaHectares,
    miningRights,
    protectedAreas,
    reinfo,
    satellite,
    territorial: {
      sourceKey: "bdpi",
      sourceName: "Ministerio de Cultura — BDPI (contexto territorial)",
      official: true,
      tier: "demo",
      status: "NOT_CONFIGURED",
      fetchedAt: new Date().toISOString(),
      records: [],
      warnings: ["Demonstration run. Territorial context is not simulated."],
    },
    water: {
      sourceKey: "ana",
      sourceName: "ANA — Recursos hídricos (SNIRH)",
      official: true,
      tier: "demo",
      status: "NOT_CONFIGURED",
      fetchedAt: new Date().toISOString(),
      records: [],
      warnings: ["Demonstration run. Water context is not simulated."],
    },
    evidence,
    collectedAt: new Date().toISOString(),
    // Fixtures stand in for a live query, not for a dated snapshot; calling
    // this "corpus" would attach a reproducibility claim to invented data.
    basisMode: "live",
    corpusBasis: [],
  };
}

/** Runs a full screening for a project and returns the persisted-ready assessment. */
export async function assessProject(
  project: Project,
  options: CreateAssessmentOptions = {},
): Promise<Assessment> {
  const startedAt = Date.now();

  if (project.demo) {
    if (!isDemoMode()) {
      throw new Error(
        "This project holds demonstration data, but demo mode is disabled on this deployment. Set NEXT_PUBLIC_DEMO_MODE=true to run it.",
      );
    }
    const bundle = buildDemoBundle(project);
    return runAssessment({
      projectId: project.id,
      projectName: project.name,
      geometrySummary: project.geometrySummary,
      bundle,
      ruleVersion: options.ruleVersion,
      demoMode: true,
      startedAt,
    });
  }

  const bundle = await collectEvidence(project.geometry, project.geometrySummary.areaHectares, {
    reinfoQuery: options.reinfoQuery,
    includeSatellite: options.includeSatellite,
  });

  return runAssessment({
    projectId: project.id,
    projectName: project.name,
    geometrySummary: project.geometrySummary,
    bundle,
    ruleVersion: options.ruleVersion,
    demoMode: false,
    startedAt,
  });
}
