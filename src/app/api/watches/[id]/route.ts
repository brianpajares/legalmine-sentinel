import { getCorpusStore } from "@/lib/corpus/store";
import { buildWatchReport } from "@/lib/corpus/diff";
import { isPeriod, periodOf } from "@/lib/corpus/period";
import { badRequest, notFound, ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getCorpusStore();
    const watch = await store.getWatch(id);
    if (!watch) return notFound("Watch not found.");
    return ok({ watch, reports: await store.listWatchReports(id, 24) });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * Generates the change report for a period on demand.
 *
 * The monthly cron does this automatically; this exists so a customer can pull
 * the current month without waiting for the schedule, and so a report can be
 * regenerated if a harvest completed late.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getCorpusStore();
    const watch = await store.getWatch(id);
    if (!watch) return notFound("Watch not found.");

    const period = new URL(request.url).searchParams.get("period") ?? periodOf();
    if (!isPeriod(period)) {
      return badRequest("Invalid period", `Expected YYYY-MM, received "${period}".`, "bad_period");
    }

    const report = await buildWatchReport(watch, period);
    await store.saveWatchReport(report);
    await store.saveWatch({ ...watch, lastReportedPeriod: period });
    return ok({ report });
  } catch (error) {
    return serverError(error);
  }
}

/** Deactivates a watch. The reports it already produced are kept, because a
 *  cancelled subscription should not erase evidence the customer relied on. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const store = await getCorpusStore();
    const watch = await store.getWatch(id);
    if (!watch) return notFound("Watch not found.");
    const updated = await store.saveWatch({ ...watch, active: false });
    return ok({ watch: updated });
  } catch (error) {
    return serverError(error);
  }
}
