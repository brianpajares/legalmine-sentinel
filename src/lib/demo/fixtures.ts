import type { GeoGeometry } from "@/types/geo";
import type { SourceResult } from "@/types/sources";
import type { MiningRightRecord } from "@/lib/sources/ingemmet";
import type { ProtectedAreaRecord } from "@/lib/sources/sernanp";
import type { ReinfoRecord } from "@/lib/sources/reinfo";
import type { SatelliteSceneRecord } from "@/lib/sources/copernicus";
import { overlap } from "@/lib/geo/measure";

/**
 * Fixture data for DEMO_MODE only (Plan Maestro §11.2).
 *
 * Everything here is invented. It is kept in this single file, tagged
 * `tier: "demo"` and `official: false`, so it can never be confused with a
 * government record: the UI renders a DEMO watermark on any evidence carrying
 * that tier, and the dossier refuses to omit the banner.
 *
 * The demo runs through the exact same engine as a verified assessment. Only
 * the inputs are fictional.
 */

export const DEMO_ORG_ID = "demo-org";

/** A polygon in Madre de Dios, used purely as a plausible area of interest. */
export const DEMO_AOI: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-69.86, -12.9],
      [-69.82, -12.9],
      [-69.82, -12.93],
      [-69.86, -12.93],
      [-69.86, -12.9],
    ],
  ],
};

export const DEMO_PROJECT_NAME = "DEMO — Inambari block screening";

const DEMO_RIGHT_GEOMETRY: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-69.85, -12.905],
      [-69.825, -12.905],
      [-69.825, -12.925],
      [-69.85, -12.925],
      [-69.85, -12.905],
    ],
  ],
};

const DEMO_ANP_GEOMETRY: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-69.84, -12.915],
      [-69.8, -12.915],
      [-69.8, -12.95],
      [-69.84, -12.95],
      [-69.84, -12.915],
    ],
  ],
};

function demoBase(sourceKey: string, sourceName: string) {
  return {
    sourceKey,
    sourceName: `DEMO — ${sourceName}`,
    official: false,
    tier: "demo" as const,
    status: "OK" as const,
    fetchedAt: new Date().toISOString(),
    sourceUrl: undefined,
  };
}

export function demoMiningRights(aoi: GeoGeometry): SourceResult<MiningRightRecord> {
  const measured = overlap(aoi, DEMO_RIGHT_GEOMETRY);
  return {
    ...demoBase("ingemmet", "Mining cadastre"),
    warnings: ["Fictional record generated for demonstration. Not an INGEMMET response."],
    records: [
      {
        code: "DEMO-0000001",
        name: "DEMO CONCESSION ALPHA",
        status: "TITULADO",
        holder: "DEMO HOLDER S.A.C. (fictional)",
        substance: "Metálica",
        declaredHectares: 500,
        overlapHectares: measured.areaHectares,
        overlapPercentOfAoi: measured.percentOfAoi,
        geometry: DEMO_RIGHT_GEOMETRY,
        raw: { demo: true },
      },
      {
        code: "DEMO-0000002",
        name: "DEMO PETITION BETA",
        status: "EN TRAMITE",
        holder: "DEMO EXPLORATION E.I.R.L. (fictional)",
        substance: "Metálica",
        declaredHectares: 300,
        overlapHectares: 0,
        overlapPercentOfAoi: 0,
        geometry: null,
        raw: { demo: true },
      },
    ],
  };
}

export function demoProtectedAreas(aoi: GeoGeometry): SourceResult<ProtectedAreaRecord> {
  const measured = overlap(aoi, DEMO_ANP_GEOMETRY);
  return {
    ...demoBase("sernanp", "Protected areas"),
    warnings: ["Fictional protected area generated for demonstration. Not a SERNANP response."],
    records: [
      {
        name: "DEMO PROTECTED AREA",
        category: "Reserva Nacional",
        legalNorm: "DEMO D.S. 000-0000",
        establishedAt: null,
        overlapHectares: measured.areaHectares,
        overlapPercentOfAoi: measured.percentOfAoi,
        geometry: DEMO_ANP_GEOMETRY,
        raw: { demo: true },
      },
    ],
  };
}

/**
 * Even in demo mode REINFO stays unverified. Fabricating a registration status
 * is the single most damaging thing this product could do, so the fixture
 * deliberately reproduces the real "manual check required" behaviour.
 */
export function demoReinfo(): SourceResult<ReinfoRecord> {
  return {
    ...demoBase("reinfo", "Formalization registry"),
    status: "MANUAL_VERIFICATION_REQUIRED",
    records: [],
    warnings: [
      "Registration status is never simulated, not even in demo mode. This check stays pending in every assessment until a real lookup is performed.",
    ],
  };
}

export function demoSatellite(): SourceResult<SatelliteSceneRecord> {
  return {
    ...demoBase("copernicus", "Sentinel-2 catalogue"),
    status: "NOT_CONFIGURED",
    records: [],
    warnings: [
      "No satellite imagery is simulated. Configure COPERNICUS_ENABLED=true to search the real Sentinel-2 catalogue.",
    ],
  };
}
