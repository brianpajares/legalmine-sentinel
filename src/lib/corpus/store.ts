import type {
  BBox,
  CorpusRecord,
  CorpusSnapshot,
  WatchReport,
  WatchSubscription,
} from "@/types/corpus";
import { bboxIntersects } from "./period";

/**
 * Persistence boundary for the monthly corpus.
 *
 * Mirrors the pattern used by the assessment store: an in-memory default so the
 * product runs with no configuration, and a Supabase implementation behind the
 * same interface. The memory store is ephemeral and says so — a corpus that
 * disappears on restart cannot back a reproducibility claim, and the health
 * endpoint reports that rather than letting the dossier imply durability.
 */
export interface CorpusStore {
  kind: "memory" | "supabase";
  ephemeral: boolean;

  createSnapshot(snapshot: CorpusSnapshot): Promise<CorpusSnapshot>;
  updateSnapshot(id: string, patch: Partial<CorpusSnapshot>): Promise<CorpusSnapshot>;
  getSnapshot(id: string): Promise<CorpusSnapshot | null>;
  findSnapshot(sourceKey: string, period: string): Promise<CorpusSnapshot | null>;
  activeSnapshot(sourceKey: string): Promise<CorpusSnapshot | null>;
  listSnapshots(sourceKey?: string, limit?: number): Promise<CorpusSnapshot[]>;
  /** Promotes a snapshot to ACTIVE and supersedes the previous one atomically
   *  enough that no window exists with two ACTIVE snapshots for a source. */
  activate(snapshotId: string): Promise<void>;

  putRecords(records: CorpusRecord[]): Promise<number>;
  recordsInBBox(snapshotId: string, box: BBox): Promise<CorpusRecord[]>;
  allRecords(snapshotId: string): Promise<CorpusRecord[]>;
  countRecords(snapshotId: string): Promise<number>;
  deleteRecords(snapshotId: string): Promise<void>;

  saveWatch(watch: WatchSubscription): Promise<WatchSubscription>;
  getWatch(id: string): Promise<WatchSubscription | null>;
  listWatches(activeOnly?: boolean): Promise<WatchSubscription[]>;
  saveWatchReport(report: WatchReport): Promise<WatchReport>;
  getWatchReport(id: string): Promise<WatchReport | null>;
  listWatchReports(watchId: string, limit?: number): Promise<WatchReport[]>;
}

export function createMemoryCorpusStore(): CorpusStore {
  const snapshots = new Map<string, CorpusSnapshot>();
  const records = new Map<string, CorpusRecord[]>();
  const watches = new Map<string, WatchSubscription>();
  const reports = new Map<string, WatchReport>();

  return {
    kind: "memory",
    ephemeral: true,

    async createSnapshot(snapshot) {
      snapshots.set(snapshot.id, { ...snapshot });
      records.set(snapshot.id, []);
      return { ...snapshot };
    },

    async updateSnapshot(id, patch) {
      const current = snapshots.get(id);
      if (!current) throw new Error(`Unknown snapshot ${id}`);
      const next = { ...current, ...patch, id };
      snapshots.set(id, next);
      return { ...next };
    },

    async getSnapshot(id) {
      const found = snapshots.get(id);
      return found ? { ...found } : null;
    },

    async findSnapshot(sourceKey, period) {
      for (const snapshot of snapshots.values()) {
        if (snapshot.sourceKey === sourceKey && snapshot.period === period) {
          return { ...snapshot };
        }
      }
      return null;
    },

    async activeSnapshot(sourceKey) {
      for (const snapshot of snapshots.values()) {
        if (snapshot.sourceKey === sourceKey && snapshot.status === "ACTIVE") {
          return { ...snapshot };
        }
      }
      return null;
    },

    async listSnapshots(sourceKey, limit = 50) {
      return [...snapshots.values()]
        .filter((s) => !sourceKey || s.sourceKey === sourceKey)
        .sort((a, b) => b.period.localeCompare(a.period))
        .slice(0, limit)
        .map((s) => ({ ...s }));
    },

    async activate(snapshotId) {
      const target = snapshots.get(snapshotId);
      if (!target) throw new Error(`Unknown snapshot ${snapshotId}`);
      for (const snapshot of snapshots.values()) {
        if (snapshot.sourceKey === target.sourceKey && snapshot.status === "ACTIVE") {
          snapshots.set(snapshot.id, { ...snapshot, status: "SUPERSEDED" });
        }
      }
      snapshots.set(snapshotId, { ...target, status: "ACTIVE" });
    },

    async putRecords(incoming) {
      let written = 0;
      for (const record of incoming) {
        const bucket = records.get(record.snapshotId) ?? [];
        const index = bucket.findIndex((r) => r.externalId === record.externalId);
        if (index >= 0) bucket[index] = record;
        else bucket.push(record);
        records.set(record.snapshotId, bucket);
        written += 1;
      }
      return written;
    },

    async recordsInBBox(snapshotId, box) {
      return (records.get(snapshotId) ?? []).filter(
        (record) => record.bbox === null || bboxIntersects(record.bbox, box),
      );
    },

    async allRecords(snapshotId) {
      return [...(records.get(snapshotId) ?? [])];
    },

    async countRecords(snapshotId) {
      return (records.get(snapshotId) ?? []).length;
    },

    async deleteRecords(snapshotId) {
      records.set(snapshotId, []);
    },

    async saveWatch(watch) {
      watches.set(watch.id, { ...watch });
      return { ...watch };
    },

    async getWatch(id) {
      const found = watches.get(id);
      return found ? { ...found } : null;
    },

    async listWatches(activeOnly = false) {
      return [...watches.values()]
        .filter((w) => !activeOnly || w.active)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((w) => ({ ...w }));
    },

    async saveWatchReport(report) {
      reports.set(report.id, { ...report });
      return { ...report };
    },

    async getWatchReport(id) {
      const found = reports.get(id);
      return found ? { ...found } : null;
    },

    async listWatchReports(watchId, limit = 24) {
      return [...reports.values()]
        .filter((r) => r.watchId === watchId)
        .sort((a, b) => b.period.localeCompare(a.period))
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
  };
}

let cached: CorpusStore | null = null;

export async function getCorpusStore(): Promise<CorpusStore> {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    const { createSupabaseCorpusStore } = await import("./supabase");
    cached = createSupabaseCorpusStore(url, key);
  } else {
    cached = createMemoryCorpusStore();
  }
  return cached;
}

/** Test seam, matching the assessment store. */
export function __setCorpusStore(store: CorpusStore | null): void {
  cached = store;
}
