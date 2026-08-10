import { randomUUID } from "node:crypto";

import type { PilotFeedback } from "@/types/assessment";
import { getStore } from "@/lib/store";
import { badRequest, created, ok, readJson, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FeedbackBody {
  assessmentId?: string;
  projectId?: string;
  roleOrCompanyType?: string;
  manualBaselineMinutes?: number;
  legalmineMinutes?: number;
  usefulness?: number;
  trust?: number;
  mostValuableFactor?: string;
  missingData?: string;
  wouldUseAgain?: boolean;
  wtpHypothesis?: string;
  permissionToQuote?: boolean;
  quote?: string;
}

function clampRating(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return null;
  return parsed;
}

function optionalMinutes(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Pilot feedback (Plan Maestro §13.3). These records are the only source of the
 * traction numbers shown on the landing page — nothing there is estimated.
 */
export async function POST(request: Request) {
  const body = await readJson<FeedbackBody>(request);
  if (!body) return badRequest("A JSON body is required.");

  const usefulness = clampRating(body.usefulness);
  const trust = clampRating(body.trust);
  if (usefulness === null || trust === null) {
    return badRequest("Usefulness and trust must be whole numbers between 1 and 5.");
  }
  const role = body.roleOrCompanyType?.trim();
  if (!role) return badRequest("Role or company type is required.");

  try {
    const store = await getStore();
    const feedback: PilotFeedback = {
      id: `fb_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      assessmentId: body.assessmentId?.trim() || undefined,
      projectId: body.projectId?.trim() || undefined,
      roleOrCompanyType: role,
      manualBaselineMinutes: optionalMinutes(body.manualBaselineMinutes),
      legalmineMinutes: optionalMinutes(body.legalmineMinutes),
      usefulness,
      trust,
      mostValuableFactor: body.mostValuableFactor?.trim() || undefined,
      missingData: body.missingData?.trim() || undefined,
      wouldUseAgain: body.wouldUseAgain === true,
      wtpHypothesis: body.wtpHypothesis?.trim() || undefined,
      permissionToQuote: body.permissionToQuote === true,
      quote: body.quote?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await store.saveFeedback(feedback);
    return created({ feedback: { id: feedback.id } });
  } catch (error) {
    return serverError(error);
  }
}

export async function GET() {
  try {
    const store = await getStore();
    const feedback = await store.listFeedback();
    return ok({ count: feedback.length });
  } catch (error) {
    return serverError(error);
  }
}
