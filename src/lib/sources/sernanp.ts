import type { GeoGeometry } from "@/types/geo";
import type { SourceResult } from "@/types/sources";
import { overlap } from "@/lib/geo/measure";
import { ArcGisError, queryArcGisLayer } from "./arcgis";
import { arcgisConfig, SOURCE_DEFINITIONS } from "./config";
import { pickDate, pickString } from "./fields";

const DEFINITION = SOURCE_DEFINITIONS.sernanp;

/** A protected area from the SERNANP geoservice that intersects the AOI. */
export interface ProtectedAreaRecord {
  name: string | null;
  /** Management category as published, e.g. "Reserva Nacional", "Zona Reservada". */
  category: string | null;
  legalNorm: string | null;
  establishedAt: string | null;
  overlapHectares: number;
  overlapPercentOfAoi: number;
  geometry: GeoGeometry | null;
  raw: Record<string, unknown>;
}

export async function fetchProtectedAreas(
  aoi: GeoGeometry,
): Promise<SourceResult<ProtectedAreaRecord>> {
  const fetchedAt = new Date().toISOString();
  const config = arcgisConfig.sernanp;
  const base = {
    sourceKey: DEFINITION.key,
    sourceName: DEFINITION.name,
    official: true,
    tier: "official" as const,
    fetchedAt,
    sourceUrl: DEFINITION.portalUrl,
  };

  if (!config.layerUrl) {
    return {
      ...base,
      status: "NOT_CONFIGURED",
      records: [],
      warnings: [
        "No SERNANP layer is configured for this deployment. Set SERNANP_LAYER_URL to the verified Geo ANP layer. No protected-area conclusion is produced without it.",
      ],
    };
  }

  try {
    const result = await queryArcGisLayer({ layerUrl: config.layerUrl, geometry: aoi });
    const records = result.features.map<ProtectedAreaRecord>((feature) => {
      const { attributes, geometry } = feature;
      const measured = geometry
        ? overlap(aoi, geometry)
        : { areaHectares: 0, percentOfAoi: 0, geometry: null };
      return {
        name: pickString(attributes, [config.fields.name, "ANP_NOMB", "NOMBRE", "NOMB_ANP"]),
        category: pickString(attributes, [config.fields.category, "ANP_CATEG", "CATEGORIA", "CAT"]),
        legalNorm: pickString(attributes, [config.fields.legalNorm, "D_S", "NORMA", "DISPOSITIVO"]),
        establishedAt: pickDate(attributes, [config.fields.establishedAt, "FECHA", "FECHA_ESTA"]),
        overlapHectares: measured.areaHectares,
        overlapPercentOfAoi: measured.percentOfAoi,
        geometry,
        raw: attributes,
      };
    });

    return {
      ...base,
      status: "OK",
      records,
      rawChecksum: result.checksum,
      durationMs: result.durationMs,
      sourceUrl: result.requestUrl,
      warnings: [
        "Restrictions inside a protected area depend on its category and zoning plan. An intersection is a screening signal, not an automatic prohibition.",
        ...(config.fromEnv
          ? []
          : ["The layer URL came from a built-in default rather than a verified deployment setting."]),
      ],
    };
  } catch (error) {
    const message = error instanceof ArcGisError ? error.message : "Unexpected adapter failure.";
    return {
      ...base,
      status: "UNAVAILABLE",
      records: [],
      warnings: [
        `The SERNANP protected-area layer could not be queried: ${message} No overlap conclusion is produced and data confidence is reduced.`,
      ],
    };
  }
}
