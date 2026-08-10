import { getStore } from "@/lib/store";
import { notFound, ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getStore();
    const project = await store.getProject(id);
    if (!project) {
      return notFound(
        "Project not found. If this deployment uses the ephemeral in-memory store, it was lost on restart.",
      );
    }
    const assessments = (await store.listAssessments(200)).filter((a) => a.projectId === id);
    return ok({ project, assessments });
  } catch (error) {
    return serverError(error);
  }
}
