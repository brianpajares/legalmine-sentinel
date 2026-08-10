import type { GeoGeometry } from "@/types/geo";
import type { SourceResult } from "@/types/sources";
import { bbox } from "@/lib/geo/measure";
import { copernicusConfig, SOURCE_DEFINITIONS, SOURCE_TIMEOUT_MS } from "./config";

const DEFINITION = SOURCE_DEFINITIONS.copernicus;

/**
 * One Sentinel-2 L2A scene intersecting the AOI.
 *
 * v1 reports scene metadata only: product identifier, acquisition date and
 * cloud cover. It does not compute NDVI, and it does not render a synthetic
 * "before/after" image. When no usable scene is found the assessment says
 * "satellite evidence inconclusive" instead of showing a substitute (§9.3).
 */
export interface SatelliteSceneRecord {
  productId: string;
  acquiredAt: string;
  cloudCoverPercent: number | null;
  platform: string | null;
  processingLevel: string | null;
  /** Quicklook/thumbnail served by Copernicus, when the item exposes one. */
  previewUrl: string | null;
  itemUrl: string | null;
}

interface StacItem {
  id?: string;
  properties?: Record<string, unknown>;
  assets?: Record<string, { href?: string }>;
  links?: { rel?: string; href?: string }[];
}

function toScene(item: StacItem): SatelliteSceneRecord | null {
  const props = item.properties ?? {};
  const acquired = typeof props.datetime === "string" ? props.datetime : null;
  if (!item.id || !acquired) return null;
  const cloud = props["eo:cloud_cover"] ?? props.cloudCover;
  const preview =
    item.assets?.thumbnail?.href ?? item.assets?.QUICKLOOK?.href ?? item.assets?.preview?.href ?? null;
  const self = item.links?.find((l) => l.rel === "self")?.href ?? null;
  return {
    productId: item.id,
    acquiredAt: acquired,
    cloudCoverPercent: typeof cloud === "number" ? Math.round(cloud * 100) / 100 : null,
    platform: typeof props.platform === "string" ? props.platform : null,
    processingLevel:
      typeof props["processing:level"] === "string" ? (props["processing:level"] as string) : "L2A",
    previewUrl: preview,
    itemUrl: self,
  };
}

export interface SatelliteSearchOptions {
  /** ISO date for the start of the observation window. Defaults to 18 months back. */
  from?: string;
  to?: string;
  maxCloudCover?: number;
}

export async function searchSentinelScenes(
  aoi: GeoGeometry,
  options: SatelliteSearchOptions = {},
): Promise<SourceResult<SatelliteSceneRecord>> {
  const fetchedAt = new Date().toISOString();
  const base = {
    sourceKey: DEFINITION.key,
    sourceName: DEFINITION.name,
    official: true,
    tier: "official" as const,
    fetchedAt,
    sourceUrl: DEFINITION.docsUrl,
  };

  if (!copernicusConfig.enabled) {
    return {
      ...base,
      status: "NOT_CONFIGURED",
      records: [],
      warnings: [
        "Satellite search is disabled for this deployment. Set COPERNICUS_ENABLED=true to query the Copernicus Data Space STAC catalogue. No satellite evidence is shown.",
      ],
    };
  }

  const to = options.to ?? new Date().toISOString();
  const from =
    options.from ?? new Date(Date.parse(to) - 18 * 30 * 24 * 3600 * 1000).toISOString();
  const maxCloud = options.maxCloudCover ?? 30;
  const endpoint = `${copernicusConfig.stacUrl.replace(/\/+$/, "")}/search`;
  const box = bbox(aoi);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        collections: ["SENTINEL-2"],
        bbox: box,
        datetime: `${from}/${to}`,
        limit: 50,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { features?: StacItem[] };
    const scenes = (payload.features ?? [])
      .map(toScene)
      .filter((s): s is SatelliteSceneRecord => s !== null)
      .filter((s) => s.processingLevel?.toUpperCase().includes("L2A") ?? true)
      .filter((s) => s.cloudCoverPercent === null || s.cloudCoverPercent <= maxCloud)
      .sort((a, b) => Date.parse(a.acquiredAt) - Date.parse(b.acquiredAt));

    const warnings = [
      "Scene metadata only. This build does not compute a vegetation-change index, so no change conclusion is derived from these images.",
    ];
    if (scenes.length < 2) {
      warnings.push(
        `Only ${scenes.length} usable scene(s) were found below ${maxCloud}% cloud cover. Satellite evidence is inconclusive for this area of interest.`,
      );
    }

    return {
      ...base,
      status: "OK",
      records: scenes,
      sourceUrl: `${endpoint} (bbox ${box.join(",")}, ${from}..${to})`,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    return {
      ...base,
      status: "UNAVAILABLE",
      records: [],
      warnings: [
        `The Copernicus STAC catalogue could not be reached (${message}). No satellite evidence is shown and no substitute image is generated.`,
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Picks the earliest and latest usable scenes for a before/after comparison. */
export function selectBeforeAfter(
  scenes: SatelliteSceneRecord[],
): { before: SatelliteSceneRecord; after: SatelliteSceneRecord } | null {
  if (scenes.length < 2) return null;
  const sorted = [...scenes].sort((a, b) => Date.parse(a.acquiredAt) - Date.parse(b.acquiredAt));
  return { before: sorted[0], after: sorted[sorted.length - 1] };
}
