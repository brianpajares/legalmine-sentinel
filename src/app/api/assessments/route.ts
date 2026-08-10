import { getStore } from "@/lib/store";
import { assessProject } from "@/lib/services/assessment";
import { badRequest, created, notFound, ok, readJson, serverError } from "@/lib/api/respond";
import { RULE_VERSION } from "@/lib/rules/v1";
import type { Project } from "@/types/assessment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Source queries plus geometry work can exceed the default budget on cold starts. */
export const maxDuration = 60;

interface CreateAssessmentBody {
  projectId?: string;
  /**
   * Serverless fallback. Vercel can route the project creation request and the
   * assessment request to different instances while the deployment is still
   * using the honest in-memory store. Passing the already validated project
   * snapshot lets the assessment continue without pretending memory is durable.
   */
  projectSnapshot?: Project;
  ruleVersion?: string;
  includeSatellite?: boolean;
  reinfoQuery?: string;
}

export async function GET() {
  try {
    const store = await getStore();
    const assessments = await store.listAssessments();
    return ok({
      assessments: assessments.map((a) => ({
        id: a.id,
        projectId: a.projectId,
        projectName: a.projectName,
        createdAt: a.createdAt,
        status: a.status,
        overallRisk: a.overallRisk,
        riskLevel: a.riskLevel,
        confidence: a.confidence,
        confidenceLevel: a.confidenceLevel,
        ruleVersion: a.ruleVersion,
        demoMode: a.demoMode,
      })),
      currentRuleVersion: RULE_VERSION,
      storage: { kind: store.kind, ephemeral: store.ephemeral },
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const body = await readJson<CreateAssessmentBody>(request);
  if (!body?.projectId) return badRequest("projectId is required.");

  try {
    const store = await getStore();
    let project = await store.getProject(body.projectId);
    if (!project) {
      const snapshot = body.projectSnapshot;
      if (snapshot?.id === body.projectId) {
        project = snapshot;
        await store.saveProject(project);
      } else {
        return notFound(
          store.ephemeral
            ? "Project not found in this serverless instance. Re-upload the area or configure durable storage."
            : "Project not found.",
        );
      }
    }

    const assessment = await assessProject(project, {
      ruleVersion: body.ruleVersion,
      includeSatellite: body.includeSatellite,
      reinfoQuery: body.reinfoQuery,
    });
    await store.saveAssessment(assessment);
    return created({ assessment });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown rule version")) {
      return badRequest("Unknown rule version.", error.message, "RULE_VERSION_UNKNOWN");
    }
    if (error instanceof Error && error.message.includes("demo mode is disabled")) {
      return badRequest("Demo mode is disabled.", error.message, "DEMO_DISABLED");
    }
    return serverError(error);
  }
}
