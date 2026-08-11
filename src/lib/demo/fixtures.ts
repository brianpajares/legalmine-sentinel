import type { GeoGeometry } from "@/types/geo";
import type { SourceResult } from "@/types/sources";
import type { MiningRightRecord } from "@/lib/sources/ingemmet";
import type { ProtectedAreaRecord } from "@/lib/sources/sernanp";
import type { ReinfoRecord } from "@/lib/sources/reinfo";
import type { SatelliteSceneRecord } from "@/lib/sources/copernicus";
import type { ContextRecord } from "@/lib/sources/context";
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

const DEMO_BDPI_GEOMETRY: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-69.858, -12.902],
      [-69.833, -12.902],
      [-69.833, -12.918],
      [-69.858, -12.918],
      [-69.858, -12.902],
    ],
  ],
};

const DEMO_WATER_GEOMETRY: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-69.86, -12.918],
      [-69.82, -12.918],
      [-69.82, -12.928],
      [-69.86, -12.928],
      [-69.86, -12.918],
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

/** Investor demo REINFO record. It is fictional and always rendered with the DEMO tier. */
export function demoReinfo(): SourceResult<ReinfoRecord> {
  return {
    ...demoBase("reinfo", "Formalization registry"),
    status: "OK",
    records: [
      {
        query: "INVESTOR_DEMO_SCENARIO",
        found: true,
        status: "VIGENTE - DEMO",
        declarant: "DEMO MINERO EN FORMALIZACION S.A.C.",
        representative: "DEMO REPRESENTANTE",
        ruc: "DEMO-RUC",
        rightCode: "DEMO-0000001",
        rightName: "DEMO CONCESSION ALPHA",
        codReinfo: "DEMO-REINFO-001",
        activityType: "Explotacion",
        coordinateStatus: "Coordenada declarada intersecta AOI",
        updatedAt: new Date().toISOString(),
        latitude: -12.914,
        longitude: -69.842,
        raw: { demo: true },
      },
    ],
    warnings: [
      "DEMO REINFO record generated for investor demonstration. Not a MINEM response; certified reliance still requires portal printout.",
    ],
  };
}

export function demoSatellite(): SourceResult<SatelliteSceneRecord> {
  return {
    ...demoBase("copernicus", "Sentinel-2 catalogue"),
    status: "OK",
    records: [
      {
        productId: "DEMO-S2-L2A-BEFORE",
        acquiredAt: "2026-05-15T15:02:00.000Z",
        cloudCoverPercent: 8.2,
        platform: "Sentinel-2A",
        processingLevel: "L2A",
        vegetationChangePercent: null,
        vegetationInterpretation: "Escena base DEMO para comparacion visual.",
        previewUrl: null,
        itemUrl: null,
      },
      {
        productId: "DEMO-S2-L2A-AFTER",
        acquiredAt: "2026-08-02T15:07:00.000Z",
        cloudCoverPercent: 6.4,
        platform: "Sentinel-2B",
        processingLevel: "L2A",
        vegetationChangePercent: -14.8,
        vegetationInterpretation:
          "DEMO: perdida moderada de vigor vegetal en el sector central; requiere verificacion GIS/NDVI real.",
        previewUrl: null,
        itemUrl: null,
      },
    ],
    warnings: [
      "DEMO satellite metadata and vegetation indicator. Not a Copernicus response and not a real NDVI computation.",
    ],
  };
}

export function demoTerritorial(aoi: GeoGeometry): SourceResult<ContextRecord> {
  const measured = overlap(aoi, DEMO_BDPI_GEOMETRY);
  return {
    ...demoBase("bdpi", "Territorial context"),
    warnings: ["DEMO territorial record. Reconcile real cases against BDPI and community registries."],
    records: [
      {
        label: "DEMO Comunidad Nativa Inambari",
        category: "Comunidad nativa / zona de influencia",
        sourceLabel: "BDPI DEMO",
        overlapHectares: measured.areaHectares,
        overlapPercentOfAoi: measured.percentOfAoi,
        geometry: DEMO_BDPI_GEOMETRY,
        raw: { demo: true },
      },
    ],
  };
}

export function demoWater(aoi: GeoGeometry): SourceResult<ContextRecord> {
  const measured = overlap(aoi, DEMO_WATER_GEOMETRY);
  return {
    ...demoBase("ana", "Water context"),
    warnings: ["DEMO water-management context. Real cases require ANA/SNIRH confirmation."],
    records: [
      {
        label: "DEMO Cuenca Tambopata - Inambari",
        category: "Unidad hidrografica / faja riberenya",
        sourceLabel: "ANA DEMO",
        overlapHectares: measured.areaHectares,
        overlapPercentOfAoi: measured.percentOfAoi,
        geometry: DEMO_WATER_GEOMETRY,
        raw: { demo: true },
      },
    ],
  };
}
