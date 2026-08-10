import { randomUUID } from "node:crypto";

import { getCorpusStore } from "@/lib/corpus/store";
import { harvestAll, harvestSource, type HarvestResult } from "@/lib/corpus/ingest";
import { buildWatchReport } from "@/lib/corpus/diff";
import { isPeriod, periodOf } from "@/lib/corpus/period";
import { ok, badRequest, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel caps this by plan; the harvest is resumable precisely because it will
// sometimes be cut short here.
export const maxDuration = 300;

/**
 * Monthly corpus refresh.
 *
 * Scheduled by `vercel.json` on the first of each month, and safe to call again
 * at any time: a period already built is reported as such and left untouched,
 * and a partial harvest resumes from its cursor rather than restarting.
 *
 * Authenticated with CRON_SECRET. Without that variable set the route refuses
 * to run rather than defaulting to open, because an unauthenticated harvest
 * endpoint is both a cost and a data-integrity problem.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function refreshWatches(period: string): Promise<{ reports: number; quiet: number }> {
  const store = await getCorpusStore();
  const watches = await store.listWatches(true);
  let reports = 0;
  let quiet = 0;

  for (const watch of watches) {
    if (watch.lastReportedPeriod === period) continue;
    const report = await buildWatchReport(watch, period);
    await store.saveWatchReport({ ...report, id: report.id || randomUUID() });
    await store.saveWatch({ ...watch, lastReportedPeriod: period });
    reports += 1;
    if (report.quiet) quiet += 1;
  }

  return { reports, quiet };
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return badRequest(
      "Unauthorized",
      "This endpoint requires the CRON_SECRET bearer token.",
      "unauthorized",
    );
  }

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? periodOf();
    const sourceKey = url.searchParams.get("source");

    if (!isPeriod(period)) {
      return badRequest("Invalid period", `Expected YYYY-MM, received "${period}".`, "bad_period");
    }

    const results: HarvestResult[] = sourceKey
      ? [await harvestSource({ sourceKey, period })]
      : await harvestAll({ period });

    const complete = results.every((r) => r.complete || r.status === "SKIPPED");
    // Change reports are only meaningful once every source finished the month.
    const watches = complete ? await refreshWatches(period) : { reports: 0, quiet: 0 };

    const store = await getCorpusStore();
    return ok({
      period,
      complete,
      durable: !store.ephemeral,
      results,
      watches,
      // A resumable harvest needs to be told when to come back.
      nextAction: complete
        ? "None. The period is built."
        : "Call this endpoint again to resume the harvest from its cursor.",
    });
  } catch (error) {
    return serverError(error);
  }
}

/** Vercel Cron issues GET requests; same work, same authentication. */
export async function GET(request: Request) {
  return POST(request);
}
