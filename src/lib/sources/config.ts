/**
 * Endpoint configuration for every external source (Plan Maestro §6).
 *
 * Endpoints live in environment variables, never in the client bundle, so a
 * deployment can be pointed at a verified layer without a code change. The
 * defaults below are the service roots published by each institution; the exact
 * layer index still has to be confirmed per deployment with
 * `npm run sources:probe`. Until a layer answers, the adapter reports its real
 * status rather than pretending to be connected.
 */

export interface SourceDefinition {
  key: string;
  name: string;
  official: boolean;
  /** P0 sources must answer for an assessment to be COMPLETED. */
  priority: "P0" | "P1" | "P2" | "P3";
  docsUrl: string;
  /** Human page a reviewer can open to check the same fact by hand. */
  portalUrl?: string;
  /** How old a snapshot may be before it is flagged STALE. */
  freshnessBudgetHours: number;
  /** Weight of this source when computing the authority component of confidence. */
  authorityWeight: number;
}

export const SOURCE_DEFINITIONS: Record<string, SourceDefinition> = {
  ingemmet: {
    key: "ingemmet",
    name: "INGEMMET — Catastro Minero (GEOCATMIN)",
    official: true,
    priority: "P0",
    docsUrl:
      "https://www.gob.pe/institucion/ingemmet/pages/7453-consultar-mapas-geologicos-de-catastros-y-recursos-mineros-en-peru",
    portalUrl: "https://geocatmin.ingemmet.gob.pe/geocatmin/",
    freshnessBudgetHours: 48,
    authorityWeight: 1,
  },
  sernanp: {
    key: "sernanp",
    name: "SERNANP — Áreas Naturales Protegidas (Geo ANP)",
    official: true,
    priority: "P0",
    docsUrl:
      "https://www.gob.pe/institucion/sernanp/pages/8532-conocer-la-informacion-geografica-de-las-areas-naturales-protegidas-geo-anp",
    portalUrl: "https://geo.sernanp.gob.pe/visorsernanp/",
    freshnessBudgetHours: 720,
    authorityWeight: 1,
  },
  reinfo: {
    key: "reinfo",
    name: "MINEM — Registro Integral de Formalización Minera (REINFO)",
    official: true,
    priority: "P1",
    docsUrl:
      "https://www.gob.pe/867-buscar-en-el-registro-integral-de-formalizacion-minera-reinfo",
    portalUrl: "https://pad.minem.gob.pe/REINFO_WEB/Index.aspx",
    freshnessBudgetHours: 24,
    authorityWeight: 1,
  },
  copernicus: {
    key: "copernicus",
    name: "Copernicus Data Space — Sentinel-2 L2A",
    official: true,
    priority: "P2",
    docsUrl: "https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
    freshnessBudgetHours: 8760,
    authorityWeight: 0.9,
  },
  bdpi: {
    key: "bdpi",
    name: "Ministerio de Cultura — BDPI (contexto territorial)",
    official: true,
    priority: "P2",
    docsUrl:
      "https://www.gob.pe/58079-consultar-informacion-oficial-sobre-pueblos-indigenas-y-originarios",
    freshnessBudgetHours: 2160,
    authorityWeight: 0.9,
  },
  ana: {
    key: "ana",
    name: "ANA — Recursos hídricos (SNIRH)",
    official: true,
    priority: "P2",
    docsUrl: "https://www.gob.pe/86460-acceder-al-sistema-nacional-de-informacion-de-recursos-hidricos",
    freshnessBudgetHours: 2160,
    authorityWeight: 0.9,
  },
};

/** Sources that must answer before an assessment can be reported as COMPLETED. */
export const P0_SOURCE_KEYS = Object.values(SOURCE_DEFINITIONS)
  .filter((s) => s.priority === "P0")
  .map((s) => s.key);

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export interface ArcGisLayerConfig {
  /** Full layer URL, e.g. .../MapServer/0 — the adapter appends /query. */
  layerUrl?: string;
  /** Set when the value came from an environment variable rather than a default. */
  fromEnv: boolean;
  /** Optional field mapping so a deployment can adapt to a renamed schema. */
  fields: Record<string, string>;
}

export const arcgisConfig = {
  get ingemmet(): ArcGisLayerConfig {
    const fromEnv = Boolean(env("INGEMMET_LAYER_URL"));
    return {
      layerUrl: env("INGEMMET_LAYER_URL"),
      fromEnv,
      fields: {
        code: env("INGEMMET_FIELD_CODE") ?? "CODIGOU",
        name: env("INGEMMET_FIELD_NAME") ?? "CONCESION",
        status: env("INGEMMET_FIELD_STATUS") ?? "ESTADO",
        holder: env("INGEMMET_FIELD_HOLDER") ?? "TITULAR",
        substance: env("INGEMMET_FIELD_SUBSTANCE") ?? "SUSTANCIA",
        hectares: env("INGEMMET_FIELD_HECTARES") ?? "HECTA",
      },
    };
  },
  get sernanp(): ArcGisLayerConfig {
    const fromEnv = Boolean(env("SERNANP_LAYER_URL"));
    return {
      layerUrl: env("SERNANP_LAYER_URL"),
      fromEnv,
      fields: {
        name: env("SERNANP_FIELD_NAME") ?? "ANP_NOMB",
        category: env("SERNANP_FIELD_CATEGORY") ?? "ANP_CATEG",
        legalNorm: env("SERNANP_FIELD_NORM") ?? "D_S",
        establishedAt: env("SERNANP_FIELD_DATE") ?? "FECHA",
      },
    };
  },
  get ana(): ArcGisLayerConfig {
    return { layerUrl: env("ANA_LAYER_URL"), fromEnv: Boolean(env("ANA_LAYER_URL")), fields: {} };
  },
  get bdpi(): ArcGisLayerConfig {
    return { layerUrl: env("BDPI_LAYER_URL"), fromEnv: Boolean(env("BDPI_LAYER_URL")), fields: {} };
  },
};

export const copernicusConfig = {
  get stacUrl(): string {
    return env("COPERNICUS_STAC_URL") ?? "https://catalogue.dataspace.copernicus.eu/stac";
  },
  get enabled(): boolean {
    return env("COPERNICUS_ENABLED") === "true" || Boolean(env("COPERNICUS_STAC_URL"));
  },
};

export const reinfoConfig = {
  /** Only set this when a stable official interface has been confirmed. Never scrape silently. */
  get apiUrl(): string | undefined {
    return env("REINFO_API_URL");
  },
};

/** Request timeout for any outbound source call. Serverless functions are short-lived. */
export const SOURCE_TIMEOUT_MS = Number(env("SOURCE_TIMEOUT_MS") ?? 12_000);

/**
 * Demo mode (§11.2). When true the app may render fixture data, always with a
 * visible watermark. It never changes how a real source is reported.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
