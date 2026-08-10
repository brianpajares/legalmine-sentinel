import { randomUUID } from "node:crypto";

import type { BBox, WatchSubscription } from "@/types/corpus";
import { bbox as bboxOf } from "@/lib/geo/measure";
import { getStore } from "@/lib/store";
import { getCorpusStore } from "@/lib/corpus/store";
import { badRequest, created, ok, readJson, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Monthly monitoring subscriptions.
 *
 * A screening answers "what is true today". A watch answers "what moved since
 * you last looked", every month, for an area the customer already cares about.
 * That difference is what turns a one-off report into a recurring product.
 */

export async function GET() {
  try {
    const store = await getCorpusStore();
    const watches = await store.listWatches();
    const withReports = await Promise.all(
      watches.map(async (watch) => ({
        watch,
        reports: (await store.listWatchReports(watch.id, 12)).map((report) => ({
          id: report.id,
          period: report.period,
          generatedAt: report.generatedAt,
          changeCount: report.changes.length,
          quiet: report.quiet,
          summary: report.summary,
        })),
      })),
    );
    return ok({ watches: withReports, durable: !store.ephemeral });
  } catch (error) {
    return serverError(error);
  }
}

interface CreateWatchBody {
  projectId?: string;
  notifyEmail?: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJson<CreateWatchBody>(request);
    if (!body?.projectId) {
      return badRequest("A projectId is required.", undefined, "missing_project");
    }

    const projects = await getStore();
    const project = await projects.getProject(body.projectId);
    if (!project) {
      return badRequest(
        "Unknown project.",
        "If this deployment uses the ephemeral in-memory store, the project was lost on restart.",
        "unknown_project",
      );
    }

    const corpus = await getCorpusStore();
    const existing = (await corpus.listWatches()).find(
      (watch) => watch.projectId === project.id && watch.active,
    );
    if (existing) return ok({ watch: existing, alreadyWatching: true });

    const watch: WatchSubscription = {
      id: randomUUID(),
      projectId: project.id,
      projectName: project.name,
      orgId: project.orgId,
      geometry: project.geometry,
      bbox: bboxOf(project.geometry) as BBox,
      cadence: "monthly",
      active: true,
      createdAt: new Date().toISOString(),
      lastReportedPeriod: null,
      notifyEmail: body.notifyEmail?.trim() || null,
    };

    await corpus.saveWatch(watch);
    return created({
      watch,
      // Say plainly when the first report can exist. A subscription that looks
      // active but cannot produce anything for two months is a broken promise.
      note: "The first change report is produced once two consecutive monthly snapshots exist for this area.",
    });
  } catch (error) {
    return serverError(error);
  }
}
