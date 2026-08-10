import type { GeoGeometry } from "@/types/geo";
import type { SourceResult } from "@/types/sources";
import { overlap } from "@/lib/geo/measure";
import { ArcGisError, queryArcGisLayer } from "./arcgis";
import { arcgisConfig, SOURCE_DEFINITIONS } from "./config";
import { pickDate, pickString } from "./fields";

const DEFINITION = SOURCE_DEFINITIONS.sernanp;

function uniqueRecords(records: ProtectedAreaRecord[]): ProtectedAreaRecord[] {
  const seen = new Set<string>();
  const unique: ProtectedAreaRecord[] = [];
  for (const record of records) {
    const key = [
      record.name ?? "unnamed",
      record.category ?? "uncategorized",
      record.legalNorm ?? "no-norm",
      JSON.stringify(record.raw).slice(0, 120),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

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

  if (config.layerUrls.length === 0) {
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
    const settled = await Promise.allSettled(
      config.layerUrls.map((layerUrl) => queryArcGisLayer({ layerUrl, geometry: aoi })),
    );
    const fulfilled = settled.filter(
      (item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof queryArcGisLayer>>> =>
        item.status === "fulfilled",
    );
    if (fulfilled.length === 0) {
      const firstError = settled.find((item) => item.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      throw firstError?.reason instanceof Error ? firstError.reason : new Error("No SERNANP layer answered.");
    }

    const records = uniqueRecords(
      fulfilled.flatMap((item) =>
        item.value.features.map<ProtectedAreaRecord>((feature) => {
          const { attributes, geometry } = feature;
          const measured = geometry
            ? overlap(aoi, geometry)
            : { areaHectares: 0, percentOfAoi: 0, geometry: null };
          return {
            name: pickString(attributes, [config.fields.name, "nombre", "ANP_NOMB", "NOMBRE", "NOMB_ANP"]),
            category: pickString(attributes, [
              config.fields.category,
              "categoria",
              "ANP_CATEG",
              "CATEGORIA",
              "CAT",
              "categ",
            ]),
            legalNorm: pickString(attributes, [config.fields.legalNorm, "D_S", "NORMA", "DISPOSITIVO", "norma"]),
            establishedAt: pickDate(attributes, [config.fields.establishedAt, "FECHA", "FECHA_ESTA", "fecha"]),
            overlapHectares: measured.areaHectares,
            overlapPercentOfAoi: measured.percentOfAoi,
            geometry,
            raw: attributes,
          };
        }),
      ),
    );
    const failed = settled.filter((item) => item.status === "rejected");

    return {
      ...base,
      status: "OK",
      records,
      rawChecksum: fulfilled.map((item) => item.value.checksum).join(":"),
      durationMs: fulfilled.reduce((sum, item) => sum + item.value.durationMs, 0),
      sourceUrl: fulfilled[0].value.requestUrl,
      warnings: [
        `SERNANP query covered ${fulfilled.length} layer(s): national, transitory, regional, private ANP and buffer zones when available.`,
        "Restrictions inside a protected area depend on its category and zoning plan. An intersection is a screening signal, not an automatic prohibition.",
        ...failed.map((item) => {
          const reason = item.status === "rejected" && item.reason instanceof Error
            ? item.reason.message
            : "unknown error";
          return `One SERNANP layer did not answer and was excluded from this run: ${reason}`;
        }),
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
