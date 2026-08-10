/**
 * Landing copy in English and Spanish (Plan Maestro §11.3).
 *
 * English is the default because the evaluation committee and the target
 * investors read English; the Spanish toggle exists for Peruvian pilots. Product
 * vocabulary — Assessment, Evidence, Risk Factor, Data Confidence, Due Diligence
 * Gap — stays in English in both languages on purpose.
 */

export type Language = "en" | "es";

export interface LandingCopy {
  nav: { product: string; sources: string; useCases: string; pricing: string; launch: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    disclaimer: string;
  };
  problem: { title: string; body: string; bullets: string[] };
  how: { title: string; subtitle: string; steps: { title: string; body: string }[] };
  trust: { title: string; subtitle: string; note: string };
  useCases: { title: string; items: { title: string; body: string }[] };
  traction: { title: string; subtitle: string; empty: string; labels: Record<string, string> };
  roadmap: { title: string; subtitle: string; phases: { phase: string; market: string; goal: string }[] };
  objections: { title: string; items: { q: string; a: string }[] };
  cta: {
    title: string;
    body: string;
    emailLabel: string;
    emailPlaceholder: string;
    companyLabel: string;
    roleLabel: string;
    submit: string;
    success: string;
    error: string;
  };
  footer: { rights: string; disclaimer: string };
}

const en: LandingCopy = {
  nav: {
    product: "How it works",
    sources: "Data sources",
    useCases: "Use cases",
    pricing: "Pricing",
    launch: "Open the app",
  },
  hero: {
    eyebrow: "Mining due diligence & GeoRisk intelligence",
    title: "Mining intelligence before capital is committed.",
    subtitle:
      "One area of interest, checked against official registries and geospatial services, scored by an explainable rule engine, and delivered as a traceable screening dossier. Minutes instead of days — with every point of the score linked to its source.",
    primaryCta: "Run a screening",
    secondaryCta: "See how it works",
    disclaimer:
      "Preliminary screening, not legal advice. Every finding carries its source, timestamp and limitations.",
  },
  problem: {
    title: "Critical mining due-diligence data is fragmented across registries, maps and documents.",
    body: "Before an option, a joint venture, an acquisition or a new petition, someone has to open the mining cadastre, the protected-area viewer, the formalization registry and a satellite archive, reconcile them by hand, and write a memo. It takes days, it is hard to repeat, and the parts that were never checked usually go unrecorded.",
    bullets: [
      "Four or more official portals, each with its own geometry, vocabulary and update cycle.",
      "Screening memos that cannot be reproduced six months later when the decision is questioned.",
      "Silent gaps: the checks nobody ran are exactly the ones that become expensive.",
    ],
  },
  how: {
    title: "One workflow, from polygon to committee-ready dossier",
    subtitle: "Evidence first, then factors, then the score. Never the other way round.",
    steps: [
      {
        title: "1. Define the area",
        body: "Upload a KML or GeoJSON polygon, or enter a centre point and radius. The geometry is validated, measured and fingerprinted so the same area always produces the same assessment.",
      },
      {
        title: "2. Check the sources",
        body: "Each connector reports connected, stale, unavailable or manual-check-required — with the time it was queried. Missing data is shown, never filled in.",
      },
      {
        title: "3. Run the screening",
        body: "A versioned, fully deterministic rule set converts spatial and registry evidence into factors, dimensions and one overall screening risk score, plus a separate data confidence score.",
      },
      {
        title: "4. Export the evidence dossier",
        body: "A preliminary due-diligence report with the source table, the factor-by-factor breakdown, what could not be verified, and the assessment ID and rule version in the footer.",
      },
    ],
  },
  trust: {
    title: "Traceable by construction",
    subtitle:
      "Connector status is measured live at every page load. Nothing here claims a real-time government pipeline that does not exist.",
    note: "Registration status is never inferred from a risk score, and satellite imagery is never simulated. When a source cannot answer, data confidence falls and the dossier lists the check as pending.",
  },
  useCases: {
    title: "Who this is built for",
    items: [
      {
        title: "Exploration & mid-tier miners",
        body: "Screen an asset before an option, a joint venture or a portfolio expansion, and surface red flags before the investment committee meets.",
      },
      {
        title: "Mining & environmental consultancies",
        body: "Produce repeatable screening and a standard dossier across many clients, instead of rebuilding a memo from scratch each time.",
      },
      {
        title: "Investors & family offices",
        body: "Put a first risk layer on a shortlist before paying for full due diligence on assets that were never going to clear.",
      },
      {
        title: "Contractors with territorial exposure",
        body: "Understand restrictions and context around a site before committing to a proposal or a mobilization plan.",
      },
    ],
  },
  traction: {
    title: "Validation to date",
    subtitle: "Counts of records that exist in this deployment. Nothing here is projected or estimated.",
    empty:
      "No usage recorded on this deployment yet. These counters populate from real assessments and real pilot feedback — they are never pre-filled.",
    labels: {
      assessments: "Assessments completed",
      reportsGenerated: "Dossiers generated",
      pilotFeedback: "Pilot feedback responses",
      averageConfidence: "Average data confidence",
      medianTimeSavedMinutes: "Median time saved (min)",
      wouldUseAgain: "Would use again",
    },
  },
  roadmap: {
    title: "Peru is the beachhead, not the ceiling",
    subtitle:
      "Connectors and rule sets are per jurisdiction; the engine, the evidence model and the dossier are not. Adding a country means adding adapters and rules, not rewriting the core.",
    phases: [
      { phase: "Phase 0", market: "Peru", goal: "MVP, official connectors and the first pilots." },
      { phase: "Phase 1", market: "Andean region", goal: "A second jurisdiction through configuration rather than a rewrite." },
      { phase: "Phase 2", market: "United States", goal: "Proof of concept in one mining state using BLM MLRS and USGS USMIN records." },
      { phase: "Phase 3", market: "Multi-jurisdiction", goal: "Portfolio monitoring and comparative risk intelligence." },
    ],
  },
  objections: {
    title: "The questions we get asked",
    items: [
      {
        q: "Is this legal advice?",
        a: "No. It is a preliminary screening and an evidence layer. Final legal conclusions stay with qualified professionals, and the product's language is constrained to say so.",
      },
      {
        q: "Why can't GIS software do this?",
        a: "GIS shows layers. LegalMine turns them into a repeatable decision workflow: normalized records, versioned rules, explicit missing-data logic, an audit trail and a committee-ready output.",
      },
      {
        q: "What if the government data is wrong or out of date?",
        a: "We store the query timestamp, expose the source's own validity date where it publishes one, lower data confidence when a source is stale or silent, and never substitute a replacement value.",
      },
      {
        q: "What is actually proprietary?",
        a: "The normalized cross-jurisdiction data model, the versioned rule library, the evidence graph and the assessment history — not the map component.",
      },
    ],
  },
  cta: {
    title: "Run a pilot on a real asset",
    body: "Bring one polygon you are already evaluating. We will run the screening with you, hand over the dossier, and ask for fifteen minutes of honest feedback in return.",
    emailLabel: "Work email",
    emailPlaceholder: "you@company.com",
    companyLabel: "Company",
    roleLabel: "Role",
    submit: "Request a pilot",
    success: "Request received. We will reply to the address you provided.",
    error: "That request could not be saved. Check the email address and try again.",
  },
  footer: {
    rights: "LegalMine Sentinel",
    disclaimer:
      "Preliminary screening based on official and referenced data sources. Not legal advice. Cadastral and geospatial data published by government bodies is referential and must be confirmed against the official file before any transaction.",
  },
};

const es: LandingCopy = {
  nav: {
    product: "Cómo funciona",
    sources: "Fuentes de datos",
    useCases: "Casos de uso",
    pricing: "Precios",
    launch: "Abrir la app",
  },
  hero: {
    eyebrow: "Due diligence minera e inteligencia de GeoRiesgo",
    title: "Inteligencia minera antes de comprometer capital.",
    subtitle:
      "Un área de interés, contrastada con registros oficiales y servicios geoespaciales, evaluada por un motor de reglas explicable y entregada como un dossier de screening trazable. Minutos en lugar de días, con cada punto del score enlazado a su fuente.",
    primaryCta: "Ejecutar un screening",
    secondaryCta: "Ver cómo funciona",
    disclaimer:
      "Evaluación preliminar, no asesoría legal. Cada hallazgo incluye su fuente, marca de tiempo y limitaciones.",
  },
  problem: {
    title: "La información crítica para la due diligence minera está fragmentada entre registros, mapas y documentos.",
    body: "Antes de una opción, un joint venture, una adquisición o un nuevo petitorio, alguien tiene que abrir el catastro minero, el visor de áreas protegidas, el registro de formalización y un archivo satelital, conciliarlos a mano y redactar un memo. Toma días, es difícil de repetir y lo que nunca se revisó casi nunca queda registrado.",
    bullets: [
      "Cuatro o más portales oficiales, cada uno con su geometría, vocabulario y ciclo de actualización.",
      "Memos de screening que no se pueden reproducir seis meses después, cuando se cuestiona la decisión.",
      "Vacíos silenciosos: las verificaciones que nadie hizo son justamente las que salen caras.",
    ],
  },
  how: {
    title: "Un flujo, del polígono al dossier para comité",
    subtitle: "Primero la evidencia, luego los factores, luego el score. Nunca al revés.",
    steps: [
      {
        title: "1. Definir el área",
        body: "Carga un polígono KML o GeoJSON, o ingresa un punto central y un radio. La geometría se valida, se mide y se le calcula una huella, de modo que la misma área siempre produce el mismo assessment.",
      },
      {
        title: "2. Verificar las fuentes",
        body: "Cada conector reporta conectado, desactualizado, no disponible o verificación manual requerida, con la hora de consulta. Los datos faltantes se muestran; nunca se rellenan.",
      },
      {
        title: "3. Ejecutar el screening",
        body: "Un conjunto de reglas versionado y totalmente determinista convierte la evidencia espacial y registral en factores, dimensiones y un score de riesgo de screening, más un Data Confidence separado.",
      },
      {
        title: "4. Exportar el dossier de evidencia",
        body: "Un reporte preliminar de due diligence con la tabla de fuentes, el desglose factor por factor, lo que no se pudo verificar, y el Assessment ID y la versión de reglas en el pie de página.",
      },
    ],
  },
  trust: {
    title: "Trazable por construcción",
    subtitle:
      "El estado de cada conector se mide en vivo en cada carga. Aquí no se declara un pipeline gubernamental en tiempo real que no existe.",
    note: "El estado de registro nunca se infiere de un score de riesgo, y las imágenes satelitales nunca se simulan. Cuando una fuente no responde, el Data Confidence baja y el dossier registra la verificación como pendiente.",
  },
  useCases: {
    title: "Para quién está construido",
    items: [
      {
        title: "Exploradoras y mineras medianas",
        body: "Evalúa un activo antes de una opción, un joint venture o una ampliación de cartera, y detecta red flags antes de que sesione el comité de inversión.",
      },
      {
        title: "Consultoras mineras y ambientales",
        body: "Produce screening repetible y un dossier estándar para varios clientes, en lugar de rehacer un memo desde cero cada vez.",
      },
      {
        title: "Inversionistas y family offices",
        body: "Aplica una primera capa de riesgo a un shortlist antes de pagar una due diligence completa sobre activos que nunca iban a pasar el filtro.",
      },
      {
        title: "Contratistas con exposición territorial",
        body: "Entiende restricciones y contexto alrededor de un sitio antes de comprometer una propuesta o un plan de movilización.",
      },
    ],
  },
  traction: {
    title: "Validación a la fecha",
    subtitle: "Conteos de registros que existen en este despliegue. Nada aquí es proyectado ni estimado.",
    empty:
      "Aún no hay uso registrado en este despliegue. Estos contadores se llenan con assessments reales y feedback real de pilotos; nunca vienen precargados.",
    labels: {
      assessments: "Assessments completados",
      reportsGenerated: "Dossiers generados",
      pilotFeedback: "Respuestas de feedback de pilotos",
      averageConfidence: "Data Confidence promedio",
      medianTimeSavedMinutes: "Mediana de tiempo ahorrado (min)",
      wouldUseAgain: "Lo volvería a usar",
    },
  },
  roadmap: {
    title: "Perú es el beachhead, no el techo",
    subtitle:
      "Los conectores y los conjuntos de reglas son por jurisdicción; el motor, el modelo de evidencia y el dossier no lo son. Agregar un país significa agregar adaptadores y reglas, no reescribir el núcleo.",
    phases: [
      { phase: "Fase 0", market: "Perú", goal: "MVP, conectores oficiales y los primeros pilotos." },
      { phase: "Fase 1", market: "Región andina", goal: "Una segunda jurisdicción por configuración, no por reescritura." },
      { phase: "Fase 2", market: "Estados Unidos", goal: "Prueba de concepto en un estado minero usando registros de BLM MLRS y USGS USMIN." },
      { phase: "Fase 3", market: "Multi-jurisdicción", goal: "Monitoreo de cartera e inteligencia de riesgo comparativa." },
    ],
  },
  objections: {
    title: "Las preguntas que nos hacen",
    items: [
      {
        q: "¿Esto es asesoría legal?",
        a: "No. Es una evaluación preliminar y una capa de evidencia. Las conclusiones legales finales quedan con profesionales calificados, y el lenguaje del producto está restringido para decirlo así.",
      },
      {
        q: "¿Por qué no basta un software GIS?",
        a: "Un GIS muestra capas. LegalMine las convierte en un flujo de decisión repetible: registros normalizados, reglas versionadas, lógica explícita de datos faltantes, pista de auditoría y un output listo para comité.",
      },
      {
        q: "¿Y si el dato del Estado está mal o desactualizado?",
        a: "Guardamos la marca de tiempo de la consulta, exponemos la fecha de vigencia que publique la fuente, bajamos el Data Confidence cuando una fuente está desactualizada o no responde, y nunca sustituimos con un valor de reemplazo.",
      },
      {
        q: "¿Qué es realmente propietario?",
        a: "El modelo de datos normalizado entre jurisdicciones, la librería de reglas versionada, el grafo de evidencia y el historial de assessments; no el componente de mapa.",
      },
    ],
  },
  cta: {
    title: "Haz un piloto con un activo real",
    body: "Trae un polígono que ya estés evaluando. Ejecutamos el screening contigo, te entregamos el dossier y a cambio te pedimos quince minutos de feedback honesto.",
    emailLabel: "Correo corporativo",
    emailPlaceholder: "tu@empresa.com",
    companyLabel: "Empresa",
    roleLabel: "Rol",
    submit: "Solicitar un piloto",
    success: "Solicitud recibida. Responderemos al correo que indicaste.",
    error: "No se pudo guardar la solicitud. Revisa el correo e inténtalo de nuevo.",
  },
  footer: {
    rights: "LegalMine Sentinel",
    disclaimer:
      "Evaluación preliminar basada en fuentes de datos oficiales y referenciales. No constituye asesoría legal. La información catastral y geoespacial publicada por entidades del Estado es referencial y debe confirmarse contra el expediente oficial antes de cualquier transacción.",
  },
};

export const LANDING_COPY: Record<Language, LandingCopy> = { en, es };
