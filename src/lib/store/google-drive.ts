import type { Assessment, Lead, PilotFeedback, Project } from "@/types/assessment";
import { mean, median, type SavedDossier, type Store, type TractionMetrics } from "./index";

interface GoogleDriveStoreOptions {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  fileId?: string;
  folderId?: string;
  folderName?: string;
  fileName?: string;
  ownerEmail?: string;
}

interface ReportEvent {
  assessmentId: string;
  createdAt: string;
}

interface DriveDatabase {
  schemaVersion: 1;
  ownerEmail?: string;
  updatedAt: string;
  projects: Project[];
  assessments: Assessment[];
  feedback: PilotFeedback[];
  leads: Lead[];
  reportEvents: ReportEvent[];
}

interface DriveFile {
  id: string;
  name: string;
}

interface DriveContext {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fileId?: string;
  folderId?: string;
  folderName: string;
  fileName: string;
  ownerEmail?: string;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_FOLDER_NAME = "LegalMine Sentinel Database";
const DEFAULT_FILE_NAME = "legalmine-sentinel-db.json";

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} is required for the Google Drive store.`);
  return trimmed;
}

function emptyDatabase(ownerEmail?: string): DriveDatabase {
  return {
    schemaVersion: 1,
    ownerEmail,
    updatedAt: new Date().toISOString(),
    projects: [],
    assessments: [],
    feedback: [],
    leads: [],
    reportEvents: [],
  };
}

function byNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [item, ...items];
  const next = [...items];
  next[index] = item;
  return next;
}

function driveQueryLiteral(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

async function accessToken(ctx: DriveContext): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ctx.clientId,
      client_secret: ctx.clientSecret,
      refresh_token: ctx.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google OAuth refresh failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Google OAuth did not return an access token.");
  return body.access_token;
}

async function driveRequest<T>(
  ctx: DriveContext,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await accessToken(ctx);
  const response = await fetch(`${DRIVE_API}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Drive request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function driveUpload<T>(
  ctx: DriveContext,
  path: string,
  metadata: Record<string, unknown>,
  content: string,
  method: "POST" | "PATCH",
  contentType = "application/json; charset=UTF-8",
): Promise<T> {
  const token = await accessToken(ctx);
  const boundary = `legalmine_${Date.now()}_${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${contentType}`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const response = await fetch(`${DRIVE_UPLOAD}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Drive upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

async function findFile(ctx: DriveContext, query: string): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name)",
    pageSize: "1",
    supportsAllDrives: "true",
  });
  const result = await driveRequest<{ files?: DriveFile[] }>(ctx, `files?${params.toString()}`);
  return result.files?.[0] ?? null;
}

async function ensureFolderId(ctx: DriveContext): Promise<string> {
  if (ctx.folderId) return ctx.folderId;
  const query = [
    `name=${driveQueryLiteral(ctx.folderName)}`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ].join(" and ");
  const existing = await findFile(ctx, query);
  if (existing) return existing.id;

  const created = await driveRequest<DriveFile>(ctx, "files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: ctx.folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  return created.id;
}

/**
 * Finds or creates the `Dossiers/` subfolder inside the LegalMine folder.
 *
 * Kept separate from the database file so browsing the folder in Drive shows
 * one JSON (state) plus a folder of readable dossiers — a layout the customer
 * can scan without knowing anything about this application.
 */
async function ensureDossiersFolderId(ctx: DriveContext): Promise<string> {
  const parent = await ensureFolderId(ctx);
  const query = [
    `name=${driveQueryLiteral("Dossiers")}`,
    `${driveQueryLiteral(parent)} in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ].join(" and ");
  const existing = await findFile(ctx, query);
  if (existing) return existing.id;

  const created = await driveRequest<DriveFile>(ctx, "files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Dossiers",
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent],
    }),
  });
  return created.id;
}

async function ensureDatabaseFile(ctx: DriveContext): Promise<string> {
  if (ctx.fileId) return ctx.fileId;
  const folderId = await ensureFolderId(ctx);
  const query = [
    `name=${driveQueryLiteral(ctx.fileName)}`,
    `${driveQueryLiteral(folderId)} in parents`,
    "trashed=false",
  ].join(" and ");
  const existing = await findFile(ctx, query);
  if (existing) return existing.id;

  const created = await driveUpload<DriveFile>(
    ctx,
    "files?uploadType=multipart&fields=id,name",
    {
      name: ctx.fileName,
      parents: [folderId],
      mimeType: "application/json",
    },
    JSON.stringify(emptyDatabase(ctx.ownerEmail), null, 2),
    "POST",
  );
  return created.id;
}

async function readDatabase(ctx: DriveContext): Promise<{ fileId: string; db: DriveDatabase }> {
  const fileId = await ensureDatabaseFile(ctx);
  const token = await accessToken(ctx);
  const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Drive database read failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const raw = await response.text();
  const parsed = raw.trim() ? (JSON.parse(raw) as Partial<DriveDatabase>) : {};
  return {
    fileId,
    db: {
      ...emptyDatabase(ctx.ownerEmail),
      ...parsed,
      schemaVersion: 1,
      projects: parsed.projects ?? [],
      assessments: parsed.assessments ?? [],
      feedback: parsed.feedback ?? [],
      leads: parsed.leads ?? [],
      reportEvents: parsed.reportEvents ?? [],
    },
  };
}

async function writeDatabase(ctx: DriveContext, fileId: string, db: DriveDatabase): Promise<void> {
  await driveUpload<DriveFile>(
    ctx,
    `files/${fileId}?uploadType=multipart&fields=id,name`,
    { name: ctx.fileName, mimeType: "application/json" },
    JSON.stringify({ ...db, updatedAt: new Date().toISOString() }, null, 2),
    "PATCH",
  );
}

async function mutateDatabase(
  ctx: DriveContext,
  mutate: (db: DriveDatabase) => void,
): Promise<void> {
  const { fileId, db } = await readDatabase(ctx);
  mutate(db);
  await writeDatabase(ctx, fileId, db);
}

export interface DriveProbeResult {
  configured: boolean;
  missing: string[];
  ok: boolean;
  ownerEmail: string | null;
  folder: { id: string; name: string; webViewLink: string } | null;
  dossiersFolder: { id: string; name: string; webViewLink: string } | null;
  databaseFile: { id: string; name: string; webViewLink: string } | null;
  error: string | null;
  checkedAt: string;
}

/**
 * End-to-end health check for the Drive integration.
 *
 * Runs the actual OAuth exchange and touches the folders the store depends on,
 * so a green result means "the next dossier will land in Drive," not "the
 * environment variables happen to look right." Every failure mode is reported
 * with the specific reason — the point is to make the setup debuggable without
 * reading logs.
 */
export async function probeGoogleDrive(options: GoogleDriveStoreOptions): Promise<DriveProbeResult> {
  const now = () => new Date().toISOString();

  const missing: string[] = [];
  if (!options.clientId?.trim()) missing.push("GOOGLE_DRIVE_CLIENT_ID");
  if (!options.clientSecret?.trim()) missing.push("GOOGLE_DRIVE_CLIENT_SECRET");
  if (!options.refreshToken?.trim()) missing.push("GOOGLE_DRIVE_REFRESH_TOKEN");
  if (missing.length > 0) {
    return {
      configured: false,
      missing,
      ok: false,
      ownerEmail: options.ownerEmail?.trim() ?? null,
      folder: null,
      dossiersFolder: null,
      databaseFile: null,
      error: `Missing required environment variables: ${missing.join(", ")}.`,
      checkedAt: now(),
    };
  }

  const ctx: DriveContext = {
    clientId: options.clientId!.trim(),
    clientSecret: options.clientSecret!.trim(),
    refreshToken: options.refreshToken!.trim(),
    fileId: options.fileId?.trim() || undefined,
    folderId: options.folderId?.trim() || undefined,
    folderName: options.folderName?.trim() || DEFAULT_FOLDER_NAME,
    fileName: options.fileName?.trim() || DEFAULT_FILE_NAME,
    ownerEmail: options.ownerEmail?.trim() || undefined,
  };

  const withLink = (file: { id: string; name: string; webViewLink?: string }) => ({
    id: file.id,
    name: file.name,
    webViewLink:
      file.webViewLink ?? `https://drive.google.com/drive/folders/${file.id}`,
  });

  try {
    const folderId = await ensureFolderId(ctx);
    const folderMeta = await driveRequest<{ id: string; name: string; webViewLink?: string }>(
      ctx,
      `files/${encodeURIComponent(folderId)}?fields=id,name,webViewLink&supportsAllDrives=true`,
    );

    const dossiersId = await ensureDossiersFolderId(ctx);
    const dossiersMeta = await driveRequest<{ id: string; name: string; webViewLink?: string }>(
      ctx,
      `files/${encodeURIComponent(dossiersId)}?fields=id,name,webViewLink&supportsAllDrives=true`,
    );

    const dbFileId = await ensureDatabaseFile(ctx);
    const dbMeta = await driveRequest<{ id: string; name: string; webViewLink?: string }>(
      ctx,
      `files/${encodeURIComponent(dbFileId)}?fields=id,name,webViewLink&supportsAllDrives=true`,
    );

    return {
      configured: true,
      missing: [],
      ok: true,
      ownerEmail: ctx.ownerEmail ?? null,
      folder: withLink(folderMeta),
      dossiersFolder: withLink(dossiersMeta),
      databaseFile: withLink({
        ...dbMeta,
        webViewLink:
          dbMeta.webViewLink ?? `https://drive.google.com/file/d/${dbMeta.id}/view`,
      }),
      error: null,
      checkedAt: now(),
    };
  } catch (error) {
    return {
      configured: true,
      missing: [],
      ok: false,
      ownerEmail: ctx.ownerEmail ?? null,
      folder: null,
      dossiersFolder: null,
      databaseFile: null,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: now(),
    };
  }
}

export function createGoogleDriveStore(options: GoogleDriveStoreOptions): Store {
  const ctx: DriveContext = {
    clientId: required(options.clientId, "GOOGLE_DRIVE_CLIENT_ID"),
    clientSecret: required(options.clientSecret, "GOOGLE_DRIVE_CLIENT_SECRET"),
    refreshToken: required(options.refreshToken, "GOOGLE_DRIVE_REFRESH_TOKEN"),
    fileId: options.fileId?.trim() || undefined,
    folderId: options.folderId?.trim() || undefined,
    folderName: options.folderName?.trim() || DEFAULT_FOLDER_NAME,
    fileName: options.fileName?.trim() || DEFAULT_FILE_NAME,
    ownerEmail: options.ownerEmail?.trim() || undefined,
  };

  return {
    kind: "drive",
    ephemeral: false,

    async saveProject(project) {
      await mutateDatabase(ctx, (db) => {
        db.projects = upsertById(db.projects, project);
      });
      return project;
    },
    async getProject(id) {
      const { db } = await readDatabase(ctx);
      return db.projects.find((project) => project.id === id) ?? null;
    },
    async listProjects(limit = 50) {
      const { db } = await readDatabase(ctx);
      return byNewest(db.projects).slice(0, limit);
    },

    async saveAssessment(assessment) {
      await mutateDatabase(ctx, (db) => {
        db.assessments = upsertById(db.assessments, assessment);
      });
      return assessment;
    },
    async getAssessment(id) {
      const { db } = await readDatabase(ctx);
      return db.assessments.find((assessment) => assessment.id === id) ?? null;
    },
    async listAssessments(limit = 50) {
      const { db } = await readDatabase(ctx);
      return byNewest(db.assessments).slice(0, limit);
    },
    async recordReportGenerated(assessmentId) {
      await mutateDatabase(ctx, (db) => {
        db.reportEvents = upsertById(
          db.reportEvents.map((event) => ({
            id: `${event.assessmentId}:${event.createdAt}`,
            ...event,
          })),
          {
            id: `${assessmentId}:${new Date().toISOString()}`,
            assessmentId,
            createdAt: new Date().toISOString(),
          },
        ).map((event) => ({ assessmentId: event.assessmentId, createdAt: event.createdAt }));
      });
    },

    async saveFeedback(feedback) {
      await mutateDatabase(ctx, (db) => {
        db.feedback = upsertById(db.feedback, feedback);
      });
      return feedback;
    },
    async listFeedback(limit = 100) {
      const { db } = await readDatabase(ctx);
      return byNewest(db.feedback).slice(0, limit);
    },

    async saveLead(lead) {
      await mutateDatabase(ctx, (db) => {
        db.leads = upsertById(db.leads, lead);
      });
      return lead;
    },
    async listLeads(limit = 100) {
      const { db } = await readDatabase(ctx);
      return byNewest(db.leads).slice(0, limit);
    },

    async metrics(): Promise<TractionMetrics> {
      const { db } = await readDatabase(ctx);
      const timeSaved = db.feedback
        .filter((f) => f.manualBaselineMinutes != null && f.legalmineMinutes != null)
        .map((f) => (f.manualBaselineMinutes as number) - (f.legalmineMinutes as number))
        .filter((n) => Number.isFinite(n));

      return {
        projects: db.projects.length,
        assessments: db.assessments.length,
        reportsGenerated: new Set(db.reportEvents.map((event) => event.assessmentId)).size,
        pilotFeedback: db.feedback.length,
        leads: db.leads.length,
        averageConfidence: mean(db.assessments.map((a) => a.confidence)),
        medianAssessmentSeconds: median(db.assessments.map((a) => a.durationMs / 1000)),
        wouldUseAgain: {
          yes: db.feedback.filter((f) => f.wouldUseAgain).length,
          total: db.feedback.length,
        },
        medianTimeSavedMinutes: median(timeSaved),
      };
    },

    async saveDossierFile({ assessmentId, fileName, html }): Promise<SavedDossier | null> {
      const folderId = await ensureDossiersFolderId(ctx);

      // Replace an existing file with the same name so re-generating a dossier
      // does not accumulate identically-titled copies. Two runs of the same
      // assessment produce the same filename by design — one canonical file per
      // assessment, kept in step with the JSON state.
      const existing = await findFile(
        ctx,
        [
          `name=${driveQueryLiteral(fileName)}`,
          `${driveQueryLiteral(folderId)} in parents`,
          "trashed=false",
        ].join(" and "),
      );

      const metadataProps = {
        assessmentId,
        source: "legalmine-sentinel",
        renderedAt: new Date().toISOString(),
      };

      const uploaded = existing
        ? await driveUpload<DriveFile & { webViewLink?: string }>(
            ctx,
            `files/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,name,webViewLink`,
            { name: fileName, mimeType: "text/html", appProperties: metadataProps },
            html,
            "PATCH",
            "text/html; charset=UTF-8",
          )
        : await driveUpload<DriveFile & { webViewLink?: string }>(
            ctx,
            "files?uploadType=multipart&fields=id,name,webViewLink",
            {
              name: fileName,
              parents: [folderId],
              mimeType: "text/html",
              appProperties: metadataProps,
            },
            html,
            "POST",
            "text/html; charset=UTF-8",
          );

      const webViewLink =
        uploaded.webViewLink ??
        `https://drive.google.com/file/d/${uploaded.id}/view`;

      return { fileId: uploaded.id, fileName: uploaded.name, webViewLink };
    },

    async saveDataWorkbook({ assessmentId, fileName, xml }): Promise<SavedDossier | null> {
      const folderId = await ensureDossiersFolderId(ctx);

      const existing = await findFile(
        ctx,
        [
          `name=${driveQueryLiteral(fileName)}`,
          `${driveQueryLiteral(folderId)} in parents`,
          "trashed=false",
        ].join(" and "),
      );

      const metadataProps = {
        assessmentId,
        source: "legalmine-sentinel",
        kind: "workbook",
        renderedAt: new Date().toISOString(),
      };

      // Declared as Excel rather than plain XML so Drive previews it as a
      // spreadsheet and "Open with Google Sheets" appears in the menu.
      const mimeType = "application/vnd.ms-excel";

      const uploaded = existing
        ? await driveUpload<DriveFile & { webViewLink?: string }>(
            ctx,
            `files/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,name,webViewLink`,
            { name: fileName, mimeType, appProperties: metadataProps },
            xml,
            "PATCH",
            `${mimeType}; charset=UTF-8`,
          )
        : await driveUpload<DriveFile & { webViewLink?: string }>(
            ctx,
            "files?uploadType=multipart&fields=id,name,webViewLink",
            { name: fileName, parents: [folderId], mimeType, appProperties: metadataProps },
            xml,
            "POST",
            `${mimeType}; charset=UTF-8`,
          );

      return {
        fileId: uploaded.id,
        fileName: uploaded.name,
        webViewLink:
          uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`,
      };
    },
  };
}
