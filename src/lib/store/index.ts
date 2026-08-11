import type { Assessment, Lead, PilotFeedback, Project } from "@/types/assessment";

/**
 * Persistence boundary.
 *
 * The default implementation keeps everything in process memory so the product
 * runs with zero configuration. That store is ephemeral, and the app says so
 * out loud rather than implying durability it does not have. Point
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY at a project with the bundled
 * migration applied, or configure the Google Drive store, and the same
 * interface becomes durable.
 */

export interface TractionMetrics {
  projects: number;
  assessments: number;
  reportsGenerated: number;
  pilotFeedback: number;
  leads: number;
  averageConfidence: number | null;
  medianAssessmentSeconds: number | null;
  wouldUseAgain: { yes: number; total: number };
  medianTimeSavedMinutes: number | null;
}

/** Handle to a dossier the store persisted next to its assessment record. */
export interface SavedDossier {
  fileId: string;
  /** URL the customer can open to view the dossier as it was saved. */
  webViewLink: string;
  fileName: string;
}

export interface Store {
  kind: "memory" | "supabase" | "drive";
  /** True when data is lost on restart. Surfaced in /api/health. */
  ephemeral: boolean;
  saveProject(project: Project): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjects(limit?: number): Promise<Project[]>;
  saveAssessment(assessment: Assessment): Promise<Assessment>;
  getAssessment(id: string): Promise<Assessment | null>;
  listAssessments(limit?: number): Promise<Assessment[]>;
  recordReportGenerated(assessmentId: string): Promise<void>;
  saveFeedback(feedback: PilotFeedback): Promise<PilotFeedback>;
  listFeedback(limit?: number): Promise<PilotFeedback[]>;
  saveLead(lead: Lead): Promise<Lead>;
  listLeads(limit?: number): Promise<Lead[]>;
  metrics(): Promise<TractionMetrics>;
  /**
   * Persists a rendered dossier next to the assessment record, in the same
   * backing account. Optional because in-memory and Supabase stores keep no
   * files — they return `null`. The Drive store returns a link to the file in
   * the customer's own account, which is where dossiers belong: with the
   * evidence they cite, in an account this deployment does not own.
   */
  saveDossierFile?(input: {
    assessmentId: string;
    fileName: string;
    html: string;
  }): Promise<SavedDossier | null>;
  /**
   * Persists the spreadsheet companion to the dossier.
   *
   * Operators work in Excel after they read the report — filtering concessions,
   * sorting by overlap, pasting rows into a memo. Storing it beside the dossier
   * means the workbook and the narrative always describe the same run.
   */
  saveDataWorkbook?(input: {
    assessmentId: string;
    fileName: string;
    xml: string;
  }): Promise<SavedDossier | null>;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(value * 100) / 100;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

let cached: Store | null = null;

export async function getStore(): Promise<Store> {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    const { createSupabaseStore } = await import("./supabase");
    cached = createSupabaseStore(url, key);
  } else if (
    process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim()
  ) {
    const { createGoogleDriveStore } = await import("./google-drive");
    cached = createGoogleDriveStore({
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      fileId: process.env.GOOGLE_DRIVE_DB_FILE_ID,
      folderId: process.env.GOOGLE_DRIVE_DB_FOLDER_ID,
      folderName: process.env.GOOGLE_DRIVE_DB_FOLDER_NAME,
      fileName: process.env.GOOGLE_DRIVE_DB_FILE_NAME,
      ownerEmail: process.env.GOOGLE_DRIVE_OWNER_EMAIL,
    });
  } else {
    const { createMemoryStore } = await import("./memory");
    cached = createMemoryStore();
  }
  return cached;
}

/** Test seam: lets a suite swap in a fresh store. */
export function __setStore(store: Store | null): void {
  cached = store;
}
