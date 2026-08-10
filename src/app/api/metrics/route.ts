import { getStore } from "@/lib/store";
import { ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Traction metrics (Plan Maestro §12.2).
 *
 * Every number here is a count of records that actually exist. There is no
 * baseline estimate, no projected figure and no rounding up: an empty
 * deployment reports zeros, and the landing page renders "no data yet" rather
 * than inventing a trend.
 */
export async function GET() {
  try {
    const store = await getStore();
    const metrics = await store.metrics();
    return ok({
      metrics,
      storage: { kind: store.kind, ephemeral: store.ephemeral },
      note: store.ephemeral
        ? "These counts come from the in-memory store and reset when the server restarts."
        : "These counts come from durable storage.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return serverError(error);
  }
}
