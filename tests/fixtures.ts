import type { Evidence } from "@/types/evidence";
import type { GeoGeometry } from "@/types/geo";
import type { SourceResult, SourceStatus } from "@/types/sources";
import type { MiningRightRecord } from "@/lib/sources/ingemmet";
import type { ProtectedAreaRecord } from "@/lib/sources/sernanp";
import type { ReinfoRecord } from "@/lib/sources/reinfo";
import type { SatelliteSceneRecord } from "@/lib/sources/copernicus";
import type { EvidenceBundle } from "@/lib/sources/collect";
import type { CorpusBasis, EvidenceBasisMode } from "@/types/corpus";
import { overlap, summarize } from "@/lib/geo/measure";

/** A one-square-ish AOI in Madre de Dios, used as the standard test area. */
export const AOI: GeoGeometry = {
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

/** Overlaps roughly the eastern half of the AOI. */
export const RIGHT_GEOMETRY: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-69.84, -12.9],
      [-69.8, -12.9],
      [-69.8, -12.93],
      [-69.84, -12.93],
      [-69.84, -12.9],
    ],
  ],
};

export const ANP_GEOMETRY: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-69.86, -12.92],
      [-69.82, -12.92],
      [-69.82, -12.93],
      [-69.86, -12.93],
      [-69.86, -12.92],
    ],
  ],
};

export const GEOMETRY_SUMMARY = summarize({ geometry: AOI, format: "geojson", warnings: [] });

const FETCHED_AT = "2026-08-10T12:00:00.000Z";

function evidence(
  id: string,
  sourceKey: string,
  status: SourceStatus,
  kind: Evidence["kind"],
): Evidence {
  return {
    id,
    kind,
    sourceKey,
    sourceName: `${sourceKey} test source`,
    official: true,
    tier: "official",
    status,
    title: `${sourceKey} ${kind}`,
    fetchedAt: FETCHED_AT,
    metadata: {},
  };
}

export function miningRightsOk(): SourceResult<MiningRightRecord> {
  const measured = overlap(AOI, RIGHT_GEOMETRY);
  return {
    sourceKey: "ingemmet",
    sourceName: "ingemmet test source",
    official: true,
    tier: "official",
    status: "OK",
    fetchedAt: FETCHED_AT,
    warnings: [],
    records: [
      {
        code: "010293821",
        name: "TEST RIGHT",
        status: "TITULADO",
        holder: "TEST HOLDER S.A.C.",
        substance: "Metálica",
        declaredHectares: 500,
        overlapHectares: measured.areaHectares,
        overlapPercentOfAoi: measured.percentOfAoi,
        geometry: RIGHT_GEOMETRY,
        raw: {},
      },
    ],
  };
}

export function protectedAreasOk(): SourceResult<ProtectedAreaRecord> {
  const measured = overlap(AOI, ANP_GEOMETRY);
  return {
    sourceKey: "sernanp",
    sourceName: "sernanp test source",
    official: true,
    tier: "official",
    status: "OK",
    fetchedAt: FETCHED_AT,
    warnings: [],
    records: [
      {
        name: "TEST RESERVE",
        category: "Reserva Nacional",
        legalNorm: "D.S. 001-TEST",
        establishedAt: null,
        overlapHectares: measured.areaHectares,
        overlapPercentOfAoi: measured.percentOfAoi,
        geometry: ANP_GEOMETRY,
        raw: {},
      },
    ],
  };
}

export function emptySource<T>(sourceKey: string, status: SourceStatus): SourceResult<T> {
  return {
    sourceKey,
    sourceName: `${sourceKey} test source`,
    official: true,
    tier: "official",
    status,
    fetchedAt: FETCHED_AT,
    warnings: [`${sourceKey} returned ${status}`],
    records: [],
  };
}

export interface BundleOverrides {
  miningRights?: SourceResult<MiningRightRecord>;
  protectedAreas?: SourceResult<ProtectedAreaRecord>;
  reinfo?: SourceResult<ReinfoRecord>;
  satellite?: SourceResult<SatelliteSceneRecord>;
  basisMode?: EvidenceBasisMode;
  corpusBasis?: CorpusBasis[];
}

export function makeBundle(overrides: BundleOverrides = {}): EvidenceBundle {
  const miningRights = overrides.miningRights ?? miningRightsOk();
  const protectedAreas = overrides.protectedAreas ?? protectedAreasOk();
  const reinfo = overrides.reinfo ?? emptySource<ReinfoRecord>("reinfo", "MANUAL_VERIFICATION_REQUIRED");
  const satellite =
    overrides.satellite ?? emptySource<SatelliteSceneRecord>("copernicus", "NOT_CONFIGURED");

  return {
    aoi: AOI,
    aoiHectares: GEOMETRY_SUMMARY.areaHectares,
    miningRights,
    protectedAreas,
    reinfo,
    satellite,
    collectedAt: FETCHED_AT,
    evidence: [
      evidence("ev_ingemmet_status", "ingemmet", miningRights.status, "source_status"),
      evidence("ev_sernanp_status", "sernanp", protectedAreas.status, "source_status"),
      evidence("ev_reinfo_status", "reinfo", reinfo.status, "source_status"),
      evidence("ev_copernicus_status", "copernicus", satellite.status, "source_status"),
      ...miningRights.records.map((_, i) =>
        evidence(`ev_ingemmet_right_${i}`, "ingemmet", miningRights.status, "finding"),
      ),
      ...protectedAreas.records.map((_, i) =>
        evidence(`ev_sernanp_anp_${i}`, "sernanp", protectedAreas.status, "finding"),
      ),
    ],
    basisMode: overrides.basisMode ?? "live",
    corpusBasis: overrides.corpusBasis ?? [],
  };
}
