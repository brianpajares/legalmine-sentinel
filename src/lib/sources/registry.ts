import { periodOf } from "@/lib/corpus/period";

export interface SourceRegistryEntry {
  sourceKey: string;
  cadence: "live" | "monthly" | "manual";
  updatePolicy: string;
  driveStore: "assessment-db" | "source-registry" | "not-stored";
  staleWhenNotPeriod?: string;
  urls: string[];
}

export function sourceRegistry(): SourceRegistryEntry[] {
  const current = periodOf();
  return [
    {
      sourceKey: "ingemmet",
      cadence: "monthly",
      updatePolicy:
        "Harvest monthly snapshot from GEOCATMIN. If the active snapshot is older than the current or previous month, flag as STALE and use live query fallback.",
      driveStore: "assessment-db",
      staleWhenNotPeriod: current,
      urls: [
        "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_CATASTRO_MINERO_WGS84/MapServer/0",
      ],
    },
    {
      sourceKey: "sernanp",
      cadence: "monthly",
      updatePolicy:
        "Harvest monthly snapshots for ANP national, regional, private, transitory and buffer-zone layers. Alert when any layer cannot be reached.",
      driveStore: "assessment-db",
      staleWhenNotPeriod: current,
      urls: [
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/servicios_ogc/peru_sernanp_0102/MapServer/0",
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/servicios_ogc/peru_sernanp_0102/MapServer/1",
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/servicios_ogc/peru_sernanp_0102/MapServer/2",
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/servicios_ogc/peru_sernanp_0102/MapServer/3",
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/servicios_ogc/peru_sernanp_0214/MapServer/0",
      ],
    },
    {
      sourceKey: "bdpi",
      cadence: "monthly",
      updatePolicy:
        "Use public IDEP community layers for automated screening context. Reconcile hits manually against the BDPI interactive map before legal reliance.",
      driveStore: "source-registry",
      staleWhenNotPeriod: current,
      urls: [
        "https://www.idep.gob.pe/geoportal/rest/services/INSTITUCIONALES/COMUNIDADES_NATIVAS/FeatureServer/0",
        "https://www.idep.gob.pe/geoportal/rest/services/INSTITUCIONALES/COMUNIDADES_NATIVAS/FeatureServer/1",
        "https://bdpi.cultura.gob.pe/mapa-interactivo",
      ],
    },
    {
      sourceKey: "ana",
      cadence: "monthly",
      updatePolicy:
        "Use ANA-attributed hydrological and administrative context layers exposed through public Geo ANP services. Keep direct ANA/SNIRH verification as required next step.",
      driveStore: "source-registry",
      staleWhenNotPeriod: current,
      urls: [
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/sernanp_visor/servicio_descarga/MapServer/25",
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/sernanp_visor/servicio_descarga/MapServer/26",
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/sernanp_visor/servicio_descarga/MapServer/27",
        "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/sernanp_visor/servicio_descarga/MapServer/28",
      ],
    },
    {
      sourceKey: "reinfo",
      cadence: "monthly",
      updatePolicy:
        "Query official MINEM REINFO spatial layer through GEOCATMIN for AOI screening and retain monthly snapshot metadata in Drive. The MINEM portal remains the manual final check for each COD_REINFO/RUC.",
      driveStore: "source-registry",
      staleWhenNotPeriod: current,
      urls: [
        "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_REINFO/MapServer/0",
        "https://pad.minem.gob.pe/REINFO_WEB/Index.aspx",
      ],
    },
    {
      sourceKey: "copernicus",
      cadence: "live",
      updatePolicy:
        "Query Copernicus STAC live for Sentinel-2 scene metadata. This app does not compute NDVI/NDWI without a calibrated imagery pipeline.",
      driveStore: "not-stored",
      urls: ["https://catalogue.dataspace.copernicus.eu/stac"],
    },
  ];
}
