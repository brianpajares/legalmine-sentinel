import { getStore } from "@/lib/store";
import { notFound, ok, serverError } from "@/lib/api/respond";
import { headline } from "@/lib/scoring/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getStore();
    const assessment = await store.getAssessment(id);
    if (!assessment) return notFound("Assessment not found.");
    const project = await store.getProject(assessment.projectId);
    return ok({ assessment, project, headline: headline(assessment) });
  } catch (error) {
    return serverError(error);
  }
}
