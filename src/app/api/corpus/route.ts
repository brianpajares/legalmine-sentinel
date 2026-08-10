import { getCorpusStore } from "@/lib/corpus/store";
import { HARVESTABLE_SOURCES, layerUrlFor } from "@/lib/corpus/ingest";
import { periodLabel, periodOf, previousPeriod } from "@/lib/corpus/period";
import { SOURCE_DEFINITIONS } from "@/lib/sources/config";
import { ok, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * State of the monthly corpus.
 *
 * Reports what is actually on disk, per source: which period is active, when it
 * was harvested, and whether it is current. A source with no snapshot says so
 * plainly — the UI must be able to tell "no overlaps found" apart from "we have
 * not harvested this layer yet", which are opposite conclusions.
 */
export async function GET() {
  try {
    const store = await getCorpusStore();
    const current = periodOf();
    const acceptable = new Set([current, previousPeriod(current)]);

    const sources = await Promise.all(
      HARVESTABLE_SOURCES.map(async (sourceKey) => {
        const definition = SOURCE_DEFINITIONS[sourceKey];
        const active = await store.activeSnapshot(sourceKey);
        const history = await store.listSnapshots(sourceKey, 12);
        const configured = Boolean(layerUrlFor(sourceKey));

        return {
          sourceKey,
          sourceName: definition?.name ?? sourceKey,
          configured,
          activePeriod: active?.period ?? null,
          activeLabel: active ? periodLabel(active.period) : null,
          recordCount: active?.recordCount ?? 0,
          checksum: active?.checksum ?? null,
          harvestedAt: active?.completedAt ?? null,
          current: active ? acceptable.has(active.period) : false,
          state: !configured
            ? "NOT_CONFIGURED"
            : !active
              ? "NEVER_HARVESTED"
              : acceptable.has(active.period)
                ? "CURRENT"
                : "STALE",
          history: history.map((snapshot) => ({
            period: snapshot.period,
            status: snapshot.status,
            recordCount: snapshot.recordCount,
            checksum: snapshot.checksum,
            completedAt: snapshot.completedAt,
          })),
        };
      }),
    );

    return ok({
      period: current,
      periodLabel: periodLabel(current),
      durable: !store.ephemeral,
      storeKind: store.kind,
      // Corpus mode needs both P0 layers; anything less and assessments run live.
      corpusReady: sources
        .filter((s) => s.sourceKey === "ingemmet" || s.sourceKey === "sernanp")
        .every((s) => s.activePeriod !== null),
      sources,
    });
  } catch (error) {
    return serverError(error);
  }
}
