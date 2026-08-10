import type { GeoGeometry } from "@/types/geo";
import type { SourceResult } from "@/types/sources";
import { overlap } from "@/lib/geo/measure";
import { ArcGisError, queryArcGisLayer } from "./arcgis";
import { arcgisConfig, SOURCE_DEFINITIONS } from "./config";
import { pickNumber, pickString } from "./fields";

const DEFINITION = SOURCE_DEFINITIONS.ingemmet;

/**
 * A mining right returned by the INGEMMET cadastre that intersects the AOI.
 *
 * `status` is reproduced verbatim from the cadastre. The product never
 * translates it into a legality judgement (§7.6).
 */
export interface MiningRightRecord {
  code: string | null;
  name: string | null;
  /** Cadastral status exactly as published, e.g. "TITULADO", "EN TRAMITE". */
  status: string | null;
  holder: string | null;
  substance: string | null;
  declaredHectares: number | null;
  overlapHectares: number;
  overlapPercentOfAoi: number;
  geometry: GeoGeometry | null;
  raw: Record<string, unknown>;
}

export async function fetchMiningRights(
  aoi: GeoGeometry,
): Promise<SourceResult<MiningRightRecord>> {
  const fetchedAt = new Date().toISOString();
  const config = arcgisConfig.ingemmet;
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
        "No INGEMMET layer is configured for this deployment. Set INGEMMET_LAYER_URL to the verified GEOCATMIN cadastre layer. No mining-rights conclusion is produced without it.",
      ],
    };
  }

  try {
    const result = await queryArcGisLayer({ layerUrl: config.layerUrl, geometry: aoi });
    const records = result.features.map<MiningRightRecord>((feature) => {
      const { attributes, geometry } = feature;
      const measured = geometry
        ? overlap(aoi, geometry)
        : { areaHectares: 0, percentOfAoi: 0, geometry: null };
      return {
        code: pickString(attributes, [config.fields.code, "CODIGOU", "CODIGO", "COD_UNICO"]),
        name: pickString(attributes, [config.fields.name, "CONCESION", "NOMBRE", "DERECHO"]),
        status: pickString(attributes, [config.fields.status, "ESTADO", "SITUACION"]),
        holder: pickString(attributes, [config.fields.holder, "TITULAR", "PROPIETARIO"]),
        substance: pickString(attributes, [config.fields.substance, "SUSTANCIA", "TIPO"]),
        declaredHectares: pickNumber(attributes, [config.fields.hectares, "HECTA", "HECTAREAS", "AREA_HA"]),
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
        "INGEMMET publishes cadastral information as referential; boundaries and status must be confirmed against the official file (expediente) before any transaction.",
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
        `The INGEMMET cadastre could not be queried: ${message} No mining-rights conclusion is produced and data confidence is reduced.`,
      ],
    };
  }
}
