/**
 * Workspace copy in Spanish and English.
 *
 * Spanish is the default here, unlike the landing page. The landing sells to an
 * international committee; the workspace is operated by Peruvian land, legal and
 * sustainability staff, and a tool that greets them in English every time they
 * open it reads as unfinished. The toggle still exists and is honoured.
 *
 * Product vocabulary that appears in the dossier — Assessment, Evidence, Risk
 * Factor, Data Confidence — stays recognisable in both languages on purpose, so
 * a Spanish operator and an English investor can point at the same word.
 */

export type Language = "es" | "en";

export interface TabCopy {
  label: string;
  /** One line shown under the tab title: what this view answers. */
  purpose: string;
  /** Longer guidance shown at the top of the panel, for staff using it daily. */
  guidance: string;
}

export interface WorkspaceCopy {
  nav: {
    newAssessment: string;
    pricing: string;
    backToProject: string;
    sectionLabel: string;
  };
  storage: {
    checking: string;
    unconfirmed: string;
    ephemeral: string;
    ephemeralHint: string;
    driveDown: string;
    driveOk: string;
    driveOkHint: string;
  };
  header: {
    areaLabel: string;
    inputLabel: string;
    geometryLabel: string;
    rerun: string;
    running: string;
    viewReport: string;
    reportHint: string;
  };
  running: {
    title: string;
    body: string;
    steps: string[];
  };
  tabs: Record<
    "risk" | "sources" | "map" | "gaps" | "portfolio" | "feedback",
    TabCopy
  >;
  empty: {
    title: string;
    body: string;
  };
}

const es: WorkspaceCopy = {
  nav: {
    newAssessment: "Nuevo análisis",
    pricing: "Planes",
    backToProject: "Volver al proyecto",
    sectionLabel: "Análisis",
  },
  storage: {
    checking: "Verificando almacenamiento…",
    unconfirmed: "Almacenamiento no confirmado",
    ephemeral: "Memoria efímera — se pierde al reiniciar",
    ephemeralHint:
      "Configura las variables GOOGLE_DRIVE_* en Vercel para que las evaluaciones y sus dossiers queden guardados en tu Drive.",
    driveDown: "Drive configurado pero no responde",
    driveOk: "Guardando en tu Google Drive",
    driveOkHint: "Abrir la carpeta en tu Google Drive",
  },
  header: {
    areaLabel: "ha",
    inputLabel: "origen",
    geometryLabel: "huella",
    rerun: "Re-ejecutar",
    running: "Ejecutando…",
    viewReport: "Ver / descargar dossier",
    reportHint:
      "Abre el dossier imprimible. Si el almacenamiento en Drive está activo, también queda archivado allí.",
  },
  running: {
    title: "Consultando fuentes oficiales y aplicando el motor de reglas",
    body:
      "Cada conector tiene su propio tiempo límite. Una fuente que no responde se reporta como no disponible; nunca se espera indefinidamente ni se rellena con una estimación.",
    steps: [
      "Validando la geometría y calculando su huella",
      "Consultando catastro minero, áreas protegidas y registros de formalización",
      "Cruzando capas territoriales, hídricas y satelitales",
      "Aplicando reglas versionadas y congelando la evidencia",
    ],
  },
  tabs: {
    risk: {
      label: "Explorador de riesgo",
      purpose: "El veredicto y de dónde sale cada punto del puntaje.",
      guidance:
        "Cada dimensión aporta puntos al total según su peso. Las dimensiones que no pudieron evaluarse se excluyen y su peso se redistribuye, para que el total siga en escala 0–100. Abre cualquier factor para ver la evidencia exacta que lo sustenta.",
    },
    sources: {
      label: "Estado de fuentes",
      purpose: "Qué institución respondió, cuándo y con qué limitaciones.",
      guidance:
        "Esta es la trazabilidad del análisis. Una fuente en verde respondió y su dato está congelado en el dossier. Una fuente en ámbar necesita verificación manual en el portal oficial: el sistema no inventa el dato faltante.",
    },
    map: {
      label: "Mapa de evidencia",
      purpose: "Dónde caen los hallazgos respecto de tu área.",
      guidance:
        "El contorno blanco es el área que subiste. Cada capa de color es un registro oficial que respondió y quedó congelado como evidencia. Haz clic en cualquier geometría para abrir el registro que la respalda.",
    },
    gaps: {
      label: "No verificado",
      purpose: "Qué no se pudo comprobar y qué conclusión queda bloqueada.",
      guidance:
        "La pestaña más importante antes de decidir. Cada fila explica qué dato falta, por qué falta, qué conclusión NO puedes sacar por ese vacío, y el paso concreto para resolverlo.",
    },
    portfolio: {
      label: "Radar de oportunidad",
      purpose: "El área en su contexto: concesiones, vecinos y espacio libre.",
      guidance:
        "Compara tu área contra el catastro de su entorno. Sirve para responder si el bloque está rodeado, si hay espacio libre adyacente y quién es titular de lo que está al lado.",
    },
    feedback: {
      label: "Feedback de piloto",
      purpose: "Registra cuánto tiempo te ahorró y qué faltó.",
      guidance:
        "Estos datos alimentan las métricas del producto: tiempo ahorrado, confianza y disposición a pagar. Es lo que convierte un piloto en evidencia comercial.",
    },
  },
  empty: {
    title: "Sin análisis todavía",
    body: "Carga un área de interés para comenzar.",
  },
};

const en: WorkspaceCopy = {
  nav: {
    newAssessment: "New assessment",
    pricing: "Pricing",
    backToProject: "Back to project",
    sectionLabel: "Analysis",
  },
  storage: {
    checking: "Checking storage…",
    unconfirmed: "Storage not confirmed",
    ephemeral: "Ephemeral memory — lost on restart",
    ephemeralHint:
      "Set the GOOGLE_DRIVE_* variables in Vercel so assessments and their dossiers are kept in your Drive.",
    driveDown: "Drive configured but not responding",
    driveOk: "Saving to your Google Drive",
    driveOkHint: "Open the folder in your Google Drive",
  },
  header: {
    areaLabel: "ha",
    inputLabel: "input",
    geometryLabel: "geometry",
    rerun: "Re-run",
    running: "Running…",
    viewReport: "View / download dossier",
    reportHint:
      "Opens the printable dossier. When Drive storage is active it is archived there as well.",
  },
  running: {
    title: "Querying official sources and applying the rule engine",
    body:
      "Every connector has its own timeout. A source that does not answer is reported as unavailable — never waited on indefinitely, never filled in with an estimate.",
    steps: [
      "Validating the geometry and computing its fingerprint",
      "Querying the mining cadastre, protected areas and formalisation registries",
      "Cross-checking territorial, water and satellite layers",
      "Applying versioned rules and freezing the evidence",
    ],
  },
  tabs: {
    risk: {
      label: "Risk Explorer",
      purpose: "The verdict, and where every point of the score comes from.",
      guidance:
        "Each dimension contributes points according to its weight. Dimensions that could not be evaluated are excluded and their weight redistributed, so the total stays on a 0–100 scale. Open any factor to see the exact evidence behind it.",
    },
    sources: {
      label: "Source Check",
      purpose: "Which institution answered, when, and with what limitations.",
      guidance:
        "This is the audit trail. A green source answered and its value is frozen into the dossier. An amber source needs manual verification on the official portal: the system does not invent the missing value.",
    },
    map: {
      label: "Evidence map",
      purpose: "Where the findings fall relative to your area.",
      guidance:
        "The white outline is the area you uploaded. Each coloured layer is an official record that answered and was frozen as evidence. Click any geometry to open the record behind it.",
    },
    gaps: {
      label: "Not verified",
      purpose: "What could not be checked, and which conclusion that blocks.",
      guidance:
        "The most important tab before deciding. Each row states what is missing, why, which conclusion you therefore cannot draw, and the concrete step to resolve it.",
    },
    portfolio: {
      label: "Opportunity Radar",
      purpose: "The area in context: concessions, neighbours and open ground.",
      guidance:
        "Compares your area against the cadastre around it. Answers whether the block is boxed in, whether there is open ground adjacent, and who holds title next door.",
    },
    feedback: {
      label: "Pilot feedback",
      purpose: "Record how much time it saved and what was missing.",
      guidance:
        "This feeds the product metrics: time saved, confidence and willingness to pay. It is what turns a pilot into commercial evidence.",
    },
  },
  empty: {
    title: "No assessment yet",
    body: "Upload an area of interest to begin.",
  },
};

export const WORKSPACE_COPY: Record<Language, WorkspaceCopy> = { es, en };

const STORAGE_KEY = "legalmine:lang";

/**
 * The chosen language is browser state, not React state, so it is exposed as an
 * external store and read with `useSyncExternalStore`. That is what keeps the
 * server render (always Spanish) and the client render consistent without an
 * effect that writes state on mount — and it means a change in one tab is
 * observable by any component that subscribes.
 */

let current: Language | null = null;
const listeners = new Set<() => void>();

/** Reads the persisted choice, defaulting to Spanish for the operating team. */
export function readLanguage(): Language {
  if (typeof window === "undefined") return "es";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "es" ? stored : "es";
}

export function getLanguageSnapshot(): Language {
  if (current === null) current = readLanguage();
  return current;
}

/** The server has no browser storage; Spanish is the default it renders. */
export function getServerLanguageSnapshot(): Language {
  return "es";
}

export function subscribeLanguage(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setLanguage(next: Language): void {
  current = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A browser refusing storage should not break the toggle for this session.
    }
  }
  listeners.forEach((listener) => listener());
}
