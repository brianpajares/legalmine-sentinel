import type { MissingCheck, RiskDimensionKey } from "@/types/assessment";
import type { SourceStatus } from "@/types/sources";
import { isConclusive } from "@/types/sources";
import type { EvidenceBundle } from "@/lib/sources/collect";
import { coveragePercent } from "@/lib/sources/collect";
import { round } from "@/lib/geo/measure";

/**
 * Rule set 2026.08-v1.
 *
 * Every threshold in this file is a product hypothesis, versioned so that a
 * stored assessment can always be recomputed exactly as it was scored. Changing
 * a number here means publishing a new RULE_VERSION — old assessments keep
 * their original result (§5.4).
 *
 * The engine only ever runs in one direction: evidence → factor → dimension →
 * overall score. No rule is allowed to read the score it is contributing to.
 */

export const RULE_VERSION = "2026.08-v1";

export interface DimensionDefinition {
  key: RiskDimensionKey;
  label: string;
  /** Share of the overall score. The five weights sum to 1. */
  weight: number;
  description: string;
}

export const DIMENSIONS: DimensionDefinition[] = [
  {
    key: "legal_tenure",
    label: "Legal y tenencia",
    weight: 0.3,
    description:
      "Existing mining rights over the area, their published status, and registration checks that remain open.",
  },
  {
    key: "environmental",
    label: "Restricciones ambientales",
    weight: 0.25,
    description:
      "Overlap with officially designated protected areas and the severity implied by their management category.",
  },
  {
    key: "territorial",
    label: "Contexto territorial y social",
    weight: 0.2,
    description:
      "Proximity to officially recorded communities and territorial boundaries. Context for engagement planning, not a social score.",
  },
  {
    key: "water_physical",
    label: "Restricciones hídricas y físicas",
    weight: 0.1,
    description: "Water bodies and hydrological management boundaries published by the water authority.",
  },
  {
    key: "remote_sensing",
    label: "Cambio por sensores remotos",
    weight: 0.15,
    description:
      "Quantified land-cover change over the area of interest. An indicator that warrants inspection, never proof of an activity.",
  },
];

export interface RuleOutcome {
  /** Normalized severity 0-100 for this factor. Ignored when inconclusive. */
  factorScore: number;
  rationale: string;
  evidenceIds: string[];
  dataStatus: SourceStatus;
  /** True when the rule could not be evaluated; it is excluded from the score. */
  inconclusive: boolean;
  nextStep?: string;
  missingCheck?: MissingCheck;
}

export interface Rule {
  id: string;
  factorKey: string;
  dimension: RiskDimensionKey;
  label: string;
  /** Weight inside its dimension. Weights within a dimension sum to 1. */
  weight: number;
  /** Which source must be conclusive for this rule to produce a score. */
  requiredSource: string;
  evaluate(bundle: EvidenceBundle): RuleOutcome;
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

function evidenceIdsFor(bundle: EvidenceBundle, sourceKey: string): string[] {
  return bundle.evidence.filter((e) => e.sourceKey === sourceKey).map((e) => e.id);
}

function unavailable(
  bundle: EvidenceBundle,
  sourceKey: string,
  status: SourceStatus,
  missingCheck: MissingCheck,
): RuleOutcome {
  return {
    factorScore: 0,
    rationale: missingCheck.reason,
    evidenceIds: evidenceIdsFor(bundle, sourceKey),
    dataStatus: status,
    inconclusive: true,
    nextStep: missingCheck.suggestedAction,
    missingCheck,
  };
}

/** Published cadastral statuses mapped to a screening severity. */
const STATUS_SEVERITY: { match: RegExp; score: number; note: string }[] = [
  { match: /extingu|caduc|abandon|nulo/i, score: 60, note: "an extinguished or lapsed right implies the area may be contested or re-openable" },
  { match: /tr[aá]mite|petitorio|solicitud/i, score: 70, note: "a right still in process has an uncertain outcome and cannot be transacted as titled" },
  { match: /titulad|otorgad|vigente/i, score: 35, note: "a titled right is stable but held by a third party" },
];

function statusSeverity(status: string | null): { score: number; note: string } {
  if (!status) {
    return { score: 50, note: "the cadastre did not report a status for this right" };
  }
  for (const entry of STATUS_SEVERITY) {
    if (entry.match.test(status)) return { score: entry.score, note: entry.note };
  }
  return { score: 50, note: `the published status "${status}" is not mapped in rule set ${RULE_VERSION}` };
}

/** Protected-area management categories mapped to a screening severity. */
const CATEGORY_SEVERITY: { match: RegExp; score: number }[] = [
  { match: /parque nacional|santuario (nacional|hist)/i, score: 100 },
  { match: /reserva nacional|refugio de vida|bosque de protecci|reserva paisaj|reserva comunal/i, score: 80 },
  { match: /zona reservada|[aá]rea de conservaci[oó]n regional/i, score: 60 },
  { match: /[aá]rea de conservaci[oó]n privada|zona de amortiguamiento/i, score: 45 },
];

function categorySeverity(category: string | null): { score: number; note: string } {
  if (!category) {
    return { score: 55, note: "the source did not report a management category, so the mid-range default for an unclassified designation was applied" };
  }
  for (const entry of CATEGORY_SEVERITY) {
    if (entry.match.test(category)) {
      return { score: entry.score, note: `management category "${category}"` };
    }
  }
  return {
    score: 55,
    note: `management category "${category}" is not mapped in rule set ${RULE_VERSION}; the mid-range default was applied`,
  };
}

/* -------------------------------------------------------------------------- */
/* Rules                                                                       */
/* -------------------------------------------------------------------------- */

const RIGHTS_ENCUMBRANCE: Rule = {
  id: "LEG-RIGHT-01",
  factorKey: "mining_rights_encumbrance",
  dimension: "legal_tenure",
  label: "Derechos mineros existentes sobre el área",
  weight: 0.45,
  requiredSource: "ingemmet",
  evaluate(bundle) {
    const source = bundle.miningRights;
    if (!isConclusive(source.status)) {
      return unavailable(bundle, "ingemmet", source.status, {
        key: "mining_rights_encumbrance",
        label: "Cobertura de derechos mineros",
        reason: `The mining cadastre returned ${source.status.replace(/_/g, " ").toLowerCase()}, so the share of the area already covered by third-party rights is unknown.`,
        blockedConclusion:
          "No statement can be made about whether the area is free, partially encumbered, or fully covered by existing mining rights.",
        suggestedAction:
          "Query the INGEMMET cadastre directly for this polygon, or configure a verified GEOCATMIN layer for this deployment.",
      });
    }

    const overlapping = source.records.filter((r) => r.overlapHectares > 0);
    const coverage = coveragePercent(bundle.aoi, overlapping.map((r) => r.geometry));

    if (overlapping.length === 0) {
      return {
        factorScore: 10,
        rationale:
          "The cadastre returned no mining right intersecting the area of interest at the time of the query. The area appears unencumbered, which lowers tenure complexity but does not confirm availability for a new petition.",
        evidenceIds: evidenceIdsFor(bundle, "ingemmet"),
        dataStatus: source.status,
        inconclusive: false,
        nextStep:
          "Confirm availability against the official file before preparing a petition; cadastral data is referential.",
      };
    }

    return {
      factorScore: round(Math.min(100, coverage), 2),
      rationale:
        `${overlapping.length} mining right(s) returned by the cadastre intersect the area of interest, covering approximately ${round(coverage, 2)}% of it. ` +
        "Any acquisition, option or joint venture over this area has to be negotiated with the existing holders.",
      evidenceIds: evidenceIdsFor(bundle, "ingemmet"),
      dataStatus: source.status,
      inconclusive: false,
      nextStep:
        "Review the official file for each overlapping right: holder identity, validity payments, encumbrances and pending resolutions.",
    };
  },
};

const RIGHTS_STATUS: Rule = {
  id: "LEG-STATUS-01",
  factorKey: "rights_status_complexity",
  dimension: "legal_tenure",
  label: "Estado de los derechos superpuestos",
  weight: 0.35,
  requiredSource: "ingemmet",
  evaluate(bundle) {
    const source = bundle.miningRights;
    if (!isConclusive(source.status)) {
      return unavailable(bundle, "ingemmet", source.status, {
        key: "rights_status_complexity",
        label: "Estado de los derechos superpuestos",
        reason: `The mining cadastre returned ${source.status.replace(/_/g, " ").toLowerCase()}, so the published status of overlapping rights could not be read.`,
        blockedConclusion: "No statement can be made about the legal status of rights over this area.",
        suggestedAction: "Retrieve the status of each overlapping right from the official cadastre or file.",
      });
    }

    const overlapping = source.records.filter((r) => r.overlapHectares > 0);
    if (overlapping.length === 0) {
      return {
        factorScore: 10,
        rationale: "No overlapping right was returned, so no status complexity applies.",
        evidenceIds: evidenceIdsFor(bundle, "ingemmet"),
        dataStatus: source.status,
        inconclusive: false,
      };
    }

    const evaluated = overlapping.map((r) => ({ record: r, severity: statusSeverity(r.status) }));
    const worst = evaluated.reduce((max, item) => (item.severity.score > max.severity.score ? item : max));
    const statuses = [...new Set(overlapping.map((r) => r.status ?? "not reported"))];

    return {
      factorScore: worst.severity.score,
      rationale:
        `Published statuses across the overlapping rights: ${statuses.join(", ")}. ` +
        `The driving case is ${worst.record.code ?? worst.record.name ?? "an unnamed right"} — ${worst.severity.note}.`,
      evidenceIds: evidenceIdsFor(bundle, "ingemmet"),
      dataStatus: source.status,
      inconclusive: false,
      nextStep:
        "Confirm each status and its date directly in the official record; cadastral status is referential and changes without notice.",
    };
  },
};

const REINFO_CHECK: Rule = {
  id: "LEG-REINFO-01",
  factorKey: "reinfo_registration_check",
  dimension: "legal_tenure",
  label: "Verificación de registro REINFO",
  weight: 0.2,
  requiredSource: "reinfo",
  evaluate(bundle) {
    const source = bundle.reinfo;
    if (!isConclusive(source.status)) {
      return unavailable(bundle, "reinfo", source.status, {
        key: "reinfo_registration_check",
        label: "Verificación de registro REINFO",
        reason:
          "No automated REINFO lookup was executed for this assessment. No conclusion about registration status is generated.",
        blockedConclusion:
          "Nothing can be said about whether an operator in this area is registered in the formalization registry. Absence of a record is not evidence of illegality.",
        suggestedAction:
          "Search the MINEM REINFO portal by declarant or right identifier and attach the printed result to the dossier.",
      });
    }

    const found = source.records.filter((r) => r.found);
    if (found.length === 0) {
      return {
        factorScore: 15,
        rationale:
          "The official REINFO spatial layer returned no declared REINFO coordinate intersecting the area of interest. This reduces formalization-registry concern for the AOI, but it is not proof that no operator has registration elsewhere or under another identifier.",
        evidenceIds: evidenceIdsFor(bundle, "reinfo"),
        dataStatus: source.status,
        inconclusive: false,
        nextStep: "Confirm by searching the MINEM REINFO portal using holder/RUC/right identifiers from any overlapping mining rights.",
      };
    }

    const statuses = found.map((r) => r.status ?? "not reported");
    const suspended = statuses.some((s) => /suspend|inactiv|excluid|cancel|baja/i.test(s));
    const vigente = statuses.some((s) => /vigente|activo/i.test(s));
    return {
      factorScore: suspended ? 70 : vigente ? 35 : 50,
      rationale:
        `The official REINFO layer returned ${found.length} declared coordinate record(s) intersecting the AOI. ` +
        `Published statuses: ${statuses.join(", ")}.`,
      evidenceIds: evidenceIdsFor(bundle, "reinfo"),
      dataStatus: source.status,
      inconclusive: false,
      nextStep:
        "Print/attach the corresponding MINEM REINFO portal result for each COD_REINFO/RUC before relying on the status.",
    };
  },
};

const PROTECTED_AREA_OVERLAP: Rule = {
  id: "ENV-ANP-01",
  factorKey: "protected_area_overlap",
  dimension: "environmental",
  label: "Superposición con área protegida",
  weight: 0.7,
  requiredSource: "sernanp",
  evaluate(bundle) {
    const source = bundle.protectedAreas;
    if (!isConclusive(source.status)) {
      return unavailable(bundle, "sernanp", source.status, {
        key: "protected_area_overlap",
        label: "Superposición con área protegida",
        reason: `The protected-area service returned ${source.status.replace(/_/g, " ").toLowerCase()}, so overlap could not be computed.`,
        blockedConclusion:
          "No statement can be made about whether the area of interest intersects a protected area.",
        suggestedAction:
          "Run the overlap check in the SERNANP Geo ANP viewer, or configure a verified Geo ANP layer for this deployment.",
      });
    }

    const overlapping = source.records.filter((r) => r.overlapHectares > 0);
    if (overlapping.length === 0) {
      return {
        factorScore: 0,
        rationale:
          "No protected area returned by the official service intersects the area of interest. Buffer zones and regional designations outside this layer are not covered by this check.",
        evidenceIds: evidenceIdsFor(bundle, "sernanp"),
        dataStatus: source.status,
        inconclusive: false,
      };
    }

    const totalPercent = Math.min(
      100,
      overlapping.reduce((sum, r) => sum + r.overlapPercentOfAoi, 0),
    );
    const totalHectares = round(
      overlapping.reduce((sum, r) => sum + r.overlapHectares, 0),
      2,
    );
    // Any overlap is material for screening, so the scale starts at 40 and
    // climbs to 100 as the whole AOI falls inside a protected area.
    const score = round(Math.min(100, 40 + totalPercent * 0.6), 2);

    return {
      factorScore: score,
      rationale:
        `${round(totalPercent, 2)}% of the area of interest (${totalHectares} ha) intersects ${overlapping.length} officially designated protected area(s): ` +
        `${overlapping.map((r) => r.name ?? "unnamed").join(", ")}.`,
      evidenceIds: evidenceIdsFor(bundle, "sernanp"),
      dataStatus: source.status,
      inconclusive: false,
      nextStep:
        "Review the category-specific restrictions and the zoning plan of each area with a qualified environmental specialist.",
    };
  },
};

const PROTECTED_AREA_CATEGORY: Rule = {
  id: "ENV-CAT-01",
  factorKey: "protected_area_category",
  dimension: "environmental",
  label: "Severidad de la categoría del área protegida",
  weight: 0.3,
  requiredSource: "sernanp",
  evaluate(bundle) {
    const source = bundle.protectedAreas;
    if (!isConclusive(source.status)) {
      return unavailable(bundle, "sernanp", source.status, {
        key: "protected_area_category",
        label: "Severidad de categoría del ANP",
        reason: `The protected-area service returned ${source.status.replace(/_/g, " ").toLowerCase()}, so no category could be read.`,
        blockedConclusion: "No statement can be made about the restriction level applying to this area.",
        suggestedAction: "Identify the category of any intersecting area in the official SERNANP registry.",
      });
    }

    const overlapping = source.records.filter((r) => r.overlapHectares > 0);
    if (overlapping.length === 0) {
      return {
        factorScore: 0,
        rationale: "No intersecting protected area, so no category severity applies.",
        evidenceIds: evidenceIdsFor(bundle, "sernanp"),
        dataStatus: source.status,
        inconclusive: false,
      };
    }

    const evaluated = overlapping.map((r) => ({ record: r, severity: categorySeverity(r.category) }));
    const worst = evaluated.reduce((max, item) => (item.severity.score > max.severity.score ? item : max));

    return {
      factorScore: worst.severity.score,
      rationale: `The most restrictive intersecting designation is ${worst.record.name ?? "an unnamed area"} — ${worst.severity.note}.`,
      evidenceIds: evidenceIdsFor(bundle, "sernanp"),
      dataStatus: source.status,
      inconclusive: false,
      nextStep:
        "Confirm the applicable restrictions in the establishing norm and the current master plan of the area.",
    };
  },
};

const TERRITORIAL_CONTEXT: Rule = {
  id: "TER-BDPI-01",
  factorKey: "territorial_context",
  dimension: "territorial",
  label: "Comunidades y límites territoriales registrados",
  weight: 1,
  requiredSource: "bdpi",
  evaluate(bundle) {
    const source = bundle.territorial;
    if (!isConclusive(source.status)) {
      return unavailable(bundle, "bdpi", source.status, {
        key: "territorial_context",
        label: "Contexto territorial",
        reason:
          "No territorial-context layer produced a usable answer, so proximity to officially recorded communities was not evaluated.",
        blockedConclusion:
          "No statement can be made about communities, indigenous peoples' territories or other official territorial boundaries near this area.",
        suggestedAction:
          "Consult the Ministry of Culture BDPI map for this area and record the result, or configure BDPI_LAYER_URL.",
      });
    }

    const overlapping = source.records.filter((record) => record.overlapHectares > 0);
    if (overlapping.length === 0) {
      return {
        factorScore: 5,
        rationale:
          "The configured territorial context layers returned no community polygon intersecting the area of interest. This lowers social-territorial screening concern, but it does not replace BDPI/manual stakeholder verification.",
        evidenceIds: evidenceIdsFor(bundle, "bdpi"),
        dataStatus: source.status,
        inconclusive: false,
        nextStep: "Confirm the result in the BDPI interactive map before relying on it for legal or engagement planning.",
      };
    }

    const names = overlapping.map((record) => record.label ?? "unnamed record");
    return {
      factorScore: 65,
      rationale:
        `${overlapping.length} territorial context record(s) intersect the area of interest: ${names.join(", ")}. ` +
        "This is a screening signal for consultation and stakeholder mapping, not a legal conclusion.",
      evidenceIds: evidenceIdsFor(bundle, "bdpi"),
      dataStatus: source.status,
      inconclusive: false,
      nextStep: "Verify the record in BDPI/official community registries and document any consultation obligations separately.",
    };
  },
};

const WATER_CONTEXT: Rule = {
  id: "WAT-ANA-01",
  factorKey: "water_context",
  dimension: "water_physical",
  label: "Cuerpos de agua y restricciones hidrológicas",
  weight: 1,
  requiredSource: "ana",
  evaluate(bundle) {
    const source = bundle.water;
    if (!isConclusive(source.status)) {
      return unavailable(bundle, "ana", source.status, {
        key: "water_context",
        label: "Contexto hídrico",
        reason:
          "No water-resources context layer produced a usable answer, so water bodies and management boundaries were not evaluated.",
        blockedConclusion:
          "No statement can be made about rivers, water bodies or hydrological management constraints affecting this area.",
        suggestedAction:
          "Consult the ANA geoportal / SNIRH for this area and record the result, or configure ANA_LAYER_URL.",
      });
    }

    const overlapping = source.records.filter((record) => record.overlapHectares > 0);
    if (overlapping.length === 0) {
      return {
        factorScore: 5,
        rationale:
          "The configured water-context layers returned no intersecting record for this area. This does not establish absence of water rights, permits or field constraints.",
        evidenceIds: evidenceIdsFor(bundle, "ana"),
        dataStatus: source.status,
        inconclusive: false,
        nextStep: "Confirm water rights, discharges, availability and field hydrology directly with ANA/SNIRH before investment action.",
      };
    }

    return {
      factorScore: 20,
      rationale:
        `${overlapping.length} ANA water-management context record(s) intersect the area of interest: ` +
        `${overlapping.map((record) => record.label ?? "unnamed record").join(", ")}. ` +
        "These records identify the relevant hydrological/administrative context; they are not themselves a water-rights risk finding.",
      evidenceIds: evidenceIdsFor(bundle, "ana"),
      dataStatus: source.status,
      inconclusive: false,
      nextStep: "Use the reported AAA/ALA/unit names to check water availability, authorizations and discharge records in ANA/SNIRH.",
    };
  },
};

const VEGETATION_CHANGE: Rule = {
  id: "RS-NDVI-01",
  factorKey: "vegetation_change_indicator",
  dimension: "remote_sensing",
  label: "Indicador de cambio de vegetación",
  weight: 1,
  requiredSource: "copernicus",
  evaluate(bundle) {
    const source = bundle.satellite;
    const sceneCount = source.records.length;
    const reason = isConclusive(source.status)
      ? `${sceneCount} Sentinel-2 scene(s) were catalogued for this area, but this build does not compute a vegetation index, so no change value was derived.`
      : `The satellite catalogue returned ${source.status.replace(/_/g, " ").toLowerCase()}, so no scene metadata is available.`;

    return unavailable(bundle, "copernicus", isConclusive(source.status) ? "MANUAL_VERIFICATION_REQUIRED" : source.status, {
      key: "vegetation_change_indicator",
      label: "Indicador de cambio de vegetación",
      reason,
      blockedConclusion:
        "No land-cover change value is produced, and no inference about activity on the ground is made from imagery in this version.",
      suggestedAction:
        "Review the catalogued scenes in a GIS or commission an NDVI/NDWI change analysis calibrated against verified cases.",
    });
  },
};

export const RULES_V1: Rule[] = [
  RIGHTS_ENCUMBRANCE,
  RIGHTS_STATUS,
  REINFO_CHECK,
  PROTECTED_AREA_OVERLAP,
  PROTECTED_AREA_CATEGORY,
  TERRITORIAL_CONTEXT,
  WATER_CONTEXT,
  VEGETATION_CHANGE,
];

export const RULE_SETS: Record<string, Rule[]> = {
  [RULE_VERSION]: RULES_V1,
};
