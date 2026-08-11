import { getStore, type SavedDossier } from "@/lib/store";
import { dossierFilename, renderDossierHtml } from "@/lib/dossier/render";
import { notFound, ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rendering a KB-scale HTML + Drive upload is under a second on warm paths;
// this ceiling exists so a cold-boot Drive round-trip does not truncate.
export const maxDuration = 30;

/**
 * Records that a dossier was produced and, when the backing store supports it,
 * archives a self-contained copy alongside the assessment record.
 *
 * The metric is always recorded even if the upload fails, because the metric
 * measures real usage, not the durability of a downstream. The response carries
 * the Drive link when one exists so the UI can offer it to the customer.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getStore();
    const assessment = await store.getAssessment(id);
    if (!assessment) return notFound("Assessment not found.");

    await store.recordReportGenerated(id);

    let dossier: SavedDossier | null = null;
    let dossierError: string | null = null;

    if (store.saveDossierFile) {
      try {
        const project = await store.getProject(assessment.projectId);
        const projectName = project?.name ?? assessment.projectName;
        const html = renderDossierHtml({
          assessment,
          projectName,
          projectCountry: project?.country,
        });
        dossier = await store.saveDossierFile({
          assessmentId: id,
          fileName: dossierFilename(assessment, projectName),
          html,
        });
      } catch (error) {
        // Never block the metric on an upload failure. Report the reason so the
        // UI can be honest — "Saved locally; upload retried on the next print."
        dossierError = error instanceof Error ? error.message : "Unknown error saving to Drive.";
      }
    }

    return ok({
      recorded: true,
      assessmentId: id,
      storage: store.kind,
      dossier,
      dossierError,
    });
  } catch (error) {
    return serverError(error);
  }
}
