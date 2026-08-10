import { getStore } from "@/lib/store";
import { notFound, ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Evidence frozen at assessment time (Plan Maestro §24.2).
 *
 * This endpoint deliberately never re-queries a source: the dossier has to
 * reproduce what was known when the assessment ran, not what is true today.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getStore();
    const assessment = await store.getAssessment(id);
    if (!assessment) return notFound("Assessment not found.");

    return ok({
      assessmentId: assessment.id,
      ruleVersion: assessment.ruleVersion,
      frozenAt: assessment.createdAt,
      evidence: assessment.evidence,
      sourceStatus: assessment.sourceStatus,
      note: "This payload is a frozen snapshot. Sources are not re-queried when it is read.",
    });
  } catch (error) {
    return serverError(error);
  }
}
