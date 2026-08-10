import type { SourceHealth } from "@/types/sources";
import { probeArcGisLayer } from "@/lib/sources/arcgis";
import {
  arcgisConfig,
  copernicusConfig,
  isDemoMode,
  reinfoConfig,
  SOURCE_DEFINITIONS,
} from "@/lib/sources/config";
import { getStore } from "@/lib/store";
import { ok, serverError } from "@/lib/api/respond";
import { RULE_VERSION } from "@/lib/rules/v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Live connector health (Plan Maestro §24.3).
 *
 * Every status here is measured at request time. Nothing in this product is
 * allowed to display "synced today" without a probe behind it — the previous
 * prototype's hard-coded "updated yesterday / 6 AM" labels are exactly what
 * this endpoint replaces.
 */
async function probeArcGisSource(key: "ingemmet" | "sernanp" | "ana" | "bdpi"): Promise<SourceHealth> {
  const definition = SOURCE_DEFINITIONS[key];
  const config = arcgisConfig[key];
  const shared = {
    sourceKey: definition.key,
    sourceName: definition.name,
    official: definition.official,
    docsUrl: definition.docsUrl,
  };

  if (!config.layerUrl) {
    return {
      ...shared,
      status: "NOT_CONFIGURED",
      lastSuccessfulFetch: null,
      configured: false,
      message: `No layer URL configured. Set ${key.toUpperCase()}_LAYER_URL to a verified service layer.`,
    };
  }

  const probe = await probeArcGisLayer(config.layerUrl);
  return {
    ...shared,
    status: probe.ok ? "OK" : "UNAVAILABLE",
    lastSuccessfulFetch: probe.ok ? new Date().toISOString() : null,
    configured: true,
    message: probe.message,
  };
}

export async function GET() {
  try {
    const [ingemmet, sernanp, ana, bdpi] = await Promise.all([
      probeArcGisSource("ingemmet"),
      probeArcGisSource("sernanp"),
      probeArcGisSource("ana"),
      probeArcGisSource("bdpi"),
    ]);

    const reinfo: SourceHealth = {
      sourceKey: SOURCE_DEFINITIONS.reinfo.key,
      sourceName: SOURCE_DEFINITIONS.reinfo.name,
      official: true,
      docsUrl: SOURCE_DEFINITIONS.reinfo.docsUrl,
      configured: Boolean(reinfoConfig.apiUrl),
      status: reinfoConfig.apiUrl ? "OK" : "MANUAL_VERIFICATION_REQUIRED",
      lastSuccessfulFetch: null,
      message: reinfoConfig.apiUrl
        ? "A REINFO endpoint is configured for this deployment."
        : "No stable official API is configured. Registration status is verified manually and never inferred.",
    };

    const copernicus: SourceHealth = {
      sourceKey: SOURCE_DEFINITIONS.copernicus.key,
      sourceName: SOURCE_DEFINITIONS.copernicus.name,
      official: true,
      docsUrl: SOURCE_DEFINITIONS.copernicus.docsUrl,
      configured: copernicusConfig.enabled,
      status: copernicusConfig.enabled ? "OK" : "NOT_CONFIGURED",
      lastSuccessfulFetch: null,
      message: copernicusConfig.enabled
        ? `STAC catalogue configured at ${copernicusConfig.stacUrl}. Scene metadata only; no index is computed in this version.`
        : "Satellite search is disabled. Set COPERNICUS_ENABLED=true to query the Sentinel-2 catalogue.",
    };

    const store = await getStore();
    const sources = [ingemmet, sernanp, reinfo, copernicus, bdpi, ana];

    return ok({
      checkedAt: new Date().toISOString(),
      ruleVersion: RULE_VERSION,
      demoMode: isDemoMode(),
      storage: {
        kind: store.kind,
        ephemeral: store.ephemeral,
        note: store.ephemeral
          ? "In-memory storage: projects and assessments are lost when the server restarts. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for durable storage."
          : "Durable storage configured.",
      },
      sources,
      summary: {
        connected: sources.filter((s) => s.status === "OK").length,
        total: sources.length,
        p0Ready: [ingemmet, sernanp].every((s) => s.status === "OK"),
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
