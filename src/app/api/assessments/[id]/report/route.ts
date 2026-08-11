import { getStore, type SavedDossier } from "@/lib/store";
import { dossierFilename, renderDossierHtml } from "@/lib/dossier/render";
import { renderAssessmentWorkbook, workbookFilename } from "@/lib/dossier/workbook";
import { notFound, ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rendering plus two Drive round-trips is well under a second on warm paths;
// this ceiling exists so a cold-boot upload is not truncated mid-flight.
export const maxDuration = 45;

/**
 * Records that a dossier was produced and archives it to the backing store.
 *
 * Two artefacts are written when the store supports files: the narrative
 * dossier, and the spreadsheet operators actually work on afterwards. Neither
 * upload may block the metric — that measures real usage, not the health of a
 * downstream — so failures are captured and reported rather than thrown.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getStore();
    const assessment = await store.getAssessment(id);
    if (!assessment) return notFound("Assessment not found.");

    await store.recordReportGenerated(id);

    let dossier: SavedDossier | null = null;
    let workbook: SavedDossier | null = null;
    let dossierError: string | null = null;

    if (store.saveDossierFile || store.saveDataWorkbook) {
      const project = await store.getProject(assessment.projectId);
      const projectName = project?.name ?? assessment.projectName;

      if (store.saveDossierFile) {
        try {
          dossier = await store.saveDossierFile({
            assessmentId: id,
            fileName: dossierFilename(assessment, projectName),
            html: renderDossierHtml({
              assessment,
              projectName,
              projectCountry: project?.country,
            }),
          });
        } catch (error) {
          dossierError = error instanceof Error ? error.message : "Unknown error saving to Drive.";
        }
      }

      if (store.saveDataWorkbook) {
        try {
          workbook = await store.saveDataWorkbook({
            assessmentId: id,
            fileName: workbookFilename(assessment, projectName),
            xml: renderAssessmentWorkbook(assessment, projectName, project?.country ?? "PE"),
          });
        } catch (error) {
          // Keep the first failure if the dossier already failed: it is the one
          // the operator cares about most.
          dossierError ??=
            error instanceof Error ? error.message : "Unknown error saving the workbook.";
        }
      }
    }

    return ok({
      recorded: true,
      assessmentId: id,
      storage: store.kind,
      dossier,
      workbook,
      dossierError,
    });
  } catch (error) {
    return serverError(error);
  }
}
