import type { GeoGeometry } from "@/types/geo";
import type { SourceResult, SourceTier } from "@/types/sources";
import { overlap } from "@/lib/geo/measure";
import { ArcGisError, queryArcGisLayer } from "./arcgis";
import { arcgisConfig, SOURCE_DEFINITIONS } from "./config";
import { pickString } from "./fields";

export interface ContextRecord {
  label: string | null;
  category: string | null;
  sourceLabel: string | null;
  overlapHectares: number;
  overlapPercentOfAoi: number;
  geometry: GeoGeometry | null;
  raw: Record<string, unknown>;
}

function keyCandidates(sourceKey: "bdpi" | "ana"): string[] {
  return sourceKey === "bdpi"
    ? ["nom_comuni", "nombre", "NOMBRE", "nom_dpto", "nom_prov", "nom_dist"]
    : ["nombre", "name_aaa", "name_ala", "nomb_uh_n5", "NOMBRE"];
}

function categoryCandidates(sourceKey: "bdpi" | "ana"): string[] {
  return sourceKey === "bdpi"
    ? ["tipo", "categoria", "SITUACION", "comunidad", "pueblo"]
    : ["fuente", "rh", "codigo", "cod_aaa", "cod_mapa"];
}

function dedupe(records: ContextRecord[]): ContextRecord[] {
  const seen = new Set<string>();
  const out: ContextRecord[] = [];
  for (const record of records) {
    const key = [
      record.label ?? "unlabelled",
      record.category ?? "uncategorized",
      record.sourceLabel ?? "no-source",
      JSON.stringify(record.raw).slice(0, 120),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

export async function fetchContextLayers(
  sourceKey: "bdpi" | "ana",
  aoi: GeoGeometry,
): Promise<SourceResult<ContextRecord>> {
  const fetchedAt = new Date().toISOString();
  const config = arcgisConfig[sourceKey];
  const definition = SOURCE_DEFINITIONS[sourceKey];
  const base = {
    sourceKey: definition.key,
    sourceName: definition.name,
    official: true,
    tier: "official" as SourceTier,
    fetchedAt,
    sourceUrl: definition.portalUrl ?? definition.docsUrl,
  };

  if (config.layerUrls.length === 0) {
    return {
      ...base,
      status: "NOT_CONFIGURED",
      records: [],
      warnings: [`No ${sourceKey.toUpperCase()} context layer is configured for this deployment.`],
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
      throw firstError?.reason instanceof Error ? firstError.reason : new Error("No context layer answered.");
    }

    const records = dedupe(
      fulfilled.flatMap((item) =>
        item.value.features.map<ContextRecord>((feature) => {
          const measured = feature.geometry
            ? overlap(aoi, feature.geometry)
            : { areaHectares: 0, percentOfAoi: 0, geometry: null };
          return {
            label: pickString(feature.attributes, keyCandidates(sourceKey)),
            category: pickString(feature.attributes, categoryCandidates(sourceKey)),
            sourceLabel: pickString(feature.attributes, ["fuente", "FUENTE", "source", "SOURCE"]),
            overlapHectares: measured.areaHectares,
            overlapPercentOfAoi: measured.percentOfAoi,
            geometry: feature.geometry,
            raw: feature.attributes,
          };
        }),
      ),
    );

    const failed = settled.filter((item) => item.status === "rejected");
    const defaultWarning =
      sourceKey === "bdpi"
        ? "Territorial context is based on public IDEP community layers and should be reconciled with the BDPI interactive map before legal reliance."
        : "Water context is administrative/hydrological context. It is not a water-rights or discharge authorization conclusion.";

    return {
      ...base,
      status: "OK",
      records,
      rawChecksum: fulfilled.map((item) => item.value.checksum).join(":"),
      durationMs: fulfilled.reduce((sum, item) => sum + item.value.durationMs, 0),
      sourceUrl: fulfilled[0].value.requestUrl,
      warnings: [
        defaultWarning,
        ...failed.map((item) => {
          const reason = item.status === "rejected" && item.reason instanceof Error
            ? item.reason.message
            : "unknown error";
          return `One ${sourceKey.toUpperCase()} context layer did not answer and was excluded: ${reason}`;
        }),
      ],
    };
  } catch (error) {
    const message = error instanceof ArcGisError || error instanceof Error
      ? error.message
      : "Unexpected adapter failure.";
    return {
      ...base,
      status: "UNAVAILABLE",
      records: [],
      warnings: [`The ${sourceKey.toUpperCase()} context layers could not be queried: ${message}`],
    };
  }
}
