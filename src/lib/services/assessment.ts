import { createHash } from "node:crypto";

import type { Assessment, Project } from "@/types/assessment";
import type { Evidence } from "@/types/evidence";
import type { GeoGeometry } from "@/types/geo";
import { collectEvidence, type EvidenceBundle } from "@/lib/sources/collect";
import { runAssessment } from "@/lib/scoring/engine";
import {
  demoMiningRights,
  demoProtectedAreas,
  demoReinfo,
  demoSatellite,
  demoTerritorial,
  demoWater,
} from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/sources/config";

export interface CreateAssessmentOptions {
  ruleVersion?: string;
  includeSatellite?: boolean;
  reinfoQuery?: string;
}

function evidenceIdFor(sourceKey: string, discriminator: string): string {
  const digest = createHash("sha256").update(`${sourceKey}::${discriminator}`).digest("hex");
  return `ev_${sourceKey}_${digest.slice(0, 10)}`;
}

function markerBox(longitude: number | null, latitude: number | null, size = 0.002): GeoGeometry | null {
  if (longitude == null || latitude == null) return null;
  const west = longitude - size;
  const east = longitude + size;
  const south = latitude - size;
  const north = latitude + size;
  return {
    type: "Polygon",
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  };
}

function buildDemoBundle(project: Project): EvidenceBundle {
  const aoi = project.geometry;
  const miningRights = demoMiningRights(aoi);
  const protectedAreas = demoProtectedAreas(aoi);
  const reinfo = demoReinfo();
  const satellite = demoSatellite();
  const territorial = demoTerritorial(aoi);
  const water = demoWater(aoi);

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
    `${miningRights.sourceName} - ${miningRights.records.length} DEMO record(s)`,
    "DEMO data for investor walkthrough. No government service was queried.",
    { status: miningRights.status, warnings: miningRights.warnings },
  );
  for (const record of miningRights.records) {
    push(
      "ingemmet",
      miningRights.sourceName,
      miningRights.status,
      `right:${record.code}`,
      `Mining right ${record.code} - ${record.name}`,
      `DEMO mining-right record. Status: ${record.status}. Holder: ${record.holder}. Overlaps ${record.overlapPercentOfAoi}% of the AOI (${record.overlapHectares} ha).`,
      { ...record, raw: undefined },
      record.geometry,
    );
  }

  push(
    "sernanp",
    protectedAreas.sourceName,
    protectedAreas.status,
    "status:protected areas",
    `${protectedAreas.sourceName} - ${protectedAreas.records.length} DEMO record(s)`,
    "DEMO protected-area data for investor walkthrough. No government service was queried.",
    { status: protectedAreas.status, warnings: protectedAreas.warnings },
  );
  for (const record of protectedAreas.records) {
    push(
      "sernanp",
      protectedAreas.sourceName,
      protectedAreas.status,
      `anp:${record.name}`,
      `Protected area - ${record.name}`,
      `DEMO protected-area record. Category: ${record.category}. Intersects ${record.overlapPercentOfAoi}% of the AOI (${record.overlapHectares} ha).`,
      { ...record, raw: undefined },
      record.geometry,
    );
  }

  push(
    "reinfo",
    reinfo.sourceName,
    reinfo.status,
    "status:REINFO registration",
    `${reinfo.sourceName} - ${reinfo.records.length} DEMO record(s)`,
    reinfo.warnings[0],
    { status: reinfo.status, warnings: reinfo.warnings },
  );
  for (const record of reinfo.records) {
    push(
      "reinfo",
      reinfo.sourceName,
      reinfo.status,
      `reinfo:${record.codReinfo}`,
      `REINFO ${record.codReinfo} - ${record.declarant}`,
      `DEMO REINFO record. Published status: ${record.status}. Right code: ${record.rightCode}. Coordinate status: ${record.coordinateStatus}.`,
      { ...record, raw: undefined },
      markerBox(record.longitude, record.latitude),
    );
  }

  push(
    "copernicus",
    satellite.sourceName,
    satellite.status,
    "status:satellite scenes",
    `${satellite.sourceName} - ${satellite.records.length} DEMO scene(s)`,
    satellite.warnings[0],
    { status: satellite.status, warnings: satellite.warnings },
  );
  for (const scene of satellite.records) {
    push(
      "copernicus",
      satellite.sourceName,
      satellite.status,
      `scene:${scene.productId}`,
      `Sentinel-2 ${scene.processingLevel} DEMO - ${scene.productId}`,
      `DEMO scene acquired ${scene.acquiredAt}. Cloud cover ${scene.cloudCoverPercent}%. ${scene.vegetationInterpretation ?? ""}`,
      { ...scene },
      aoi,
    );
  }

  push(
    "bdpi",
    territorial.sourceName,
    territorial.status,
    "status:territorial context",
    `${territorial.sourceName} - ${territorial.records.length} DEMO record(s)`,
    territorial.warnings[0],
    { status: territorial.status, warnings: territorial.warnings },
  );
  for (const record of territorial.records) {
    push(
      "bdpi",
      territorial.sourceName,
      territorial.status,
      `context:${record.label}`,
      `${territorial.sourceName} - ${record.label}`,
      `DEMO territorial record. Category: ${record.category}. Intersects ${record.overlapPercentOfAoi}% of the AOI (${record.overlapHectares} ha).`,
      { ...record, raw: undefined },
      record.geometry,
    );
  }

  push(
    "ana",
    water.sourceName,
    water.status,
    "status:water context",
    `${water.sourceName} - ${water.records.length} DEMO record(s)`,
    water.warnings[0],
    { status: water.status, warnings: water.warnings },
  );
  for (const record of water.records) {
    push(
      "ana",
      water.sourceName,
      water.status,
      `context:${record.label}`,
      `${water.sourceName} - ${record.label}`,
      `DEMO water context. Category: ${record.category}. Intersects ${record.overlapPercentOfAoi}% of the AOI (${record.overlapHectares} ha).`,
      { ...record, raw: undefined },
      record.geometry,
    );
  }

  return {
    aoi,
    aoiHectares: project.geometrySummary.areaHectares,
    miningRights,
    protectedAreas,
    reinfo,
    satellite,
    territorial,
    water,
    evidence,
    collectedAt: new Date().toISOString(),
    basisMode: "live",
    corpusBasis: [],
  };
}

export async function assessProject(
  project: Project,
  options: CreateAssessmentOptions = {},
): Promise<Assessment> {
  const startedAt = Date.now();

  if (project.demo) {
    const isInvestorDemo = project.notes?.includes("INVESTOR_DEMO_SCENARIO");
    if (!isDemoMode() && !isInvestorDemo) {
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
