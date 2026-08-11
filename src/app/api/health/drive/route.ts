import { probeGoogleDrive } from "@/lib/store/google-drive";
import { ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Drive integration self-check.
 *
 * Confirms that the OAuth exchange still works, that the folder the store
 * writes to is reachable, and that the `Dossiers/` subfolder can be created or
 * found. A green response means "the next dossier will land in Drive" — not
 * "the environment variables look right" — so a failure here is actionable
 * without reading server logs.
 *
 * Safe to call publicly: the response never echoes secrets, only whether they
 * are present and whether they work.
 */
export async function GET() {
  try {
    const result = await probeGoogleDrive({
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      fileId: process.env.GOOGLE_DRIVE_DB_FILE_ID,
      folderId: process.env.GOOGLE_DRIVE_DB_FOLDER_ID,
      folderName: process.env.GOOGLE_DRIVE_DB_FOLDER_NAME,
      fileName: process.env.GOOGLE_DRIVE_DB_FILE_NAME,
      ownerEmail: process.env.GOOGLE_DRIVE_OWNER_EMAIL,
    });
    return ok(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return serverError(error);
  }
}
