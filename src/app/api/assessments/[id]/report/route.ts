import { getStore } from "@/lib/store";
import { notFound, ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Records that a dossier was produced, so `report_generated` is a real metric. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getStore();
    const assessment = await store.getAssessment(id);
    if (!assessment) return notFound("Assessment not found.");
    await store.recordReportGenerated(id);
    return ok({ recorded: true, assessmentId: id });
  } catch (error) {
    return serverError(error);
  }
}
