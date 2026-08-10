import type {
  BBox,
  CorpusRecord,
  CorpusSnapshot,
  WatchReport,
  WatchSubscription,
} from "@/types/corpus";
import type { CorpusStore } from "./store";

/**
 * Durable corpus backed by Supabase PostgREST.
 *
 * Same shape as the assessment store: HTTP API rather than the JS client, so
 * the deployment carries no extra dependency. Apply
 * `supabase/migrations/0002_corpus.sql` before pointing a deployment at it.
 */

interface Ctx {
  url: string;
  key: string;
}

async function request<T>(
  ctx: Ctx,
  path: string,
  init: RequestInit & { returning?: boolean } = {},
): Promise<T> {
  const response = await fetch(`${ctx.url.replace(/\/+$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ctx.key,
      Authorization: `Bearer ${ctx.key}`,
      "Content-Type": "application/json",
      ...(init.returning === false ? {} : { Prefer: "return=representation" }),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface SnapshotRow {
  id: string;
  payload: CorpusSnapshot;
}

interface RecordRow {
  snapshot_id: string;
  source_key: string;
  external_id: string;
  min_x: number | null;
  min_y: number | null;
  max_x: number | null;
  max_y: number | null;
  checksum: string;
  geometry: CorpusRecord["geometry"];
  attributes: Record<string, unknown>;
}

function toRecord(row: RecordRow): CorpusRecord {
  const hasBox =
    row.min_x !== null && row.min_y !== null && row.max_x !== null && row.max_y !== null;
  return {
    snapshotId: row.snapshot_id,
    sourceKey: row.source_key,
    externalId: row.external_id,
    geometry: row.geometry,
    bbox: hasBox ? ([row.min_x, row.min_y, row.max_x, row.max_y] as BBox) : null,
    attributes: row.attributes,
    checksum: row.checksum,
  };
}

function toRow(record: CorpusRecord): RecordRow {
  return {
    snapshot_id: record.snapshotId,
    source_key: record.sourceKey,
    external_id: record.externalId,
    min_x: record.bbox?.[0] ?? null,
    min_y: record.bbox?.[1] ?? null,
    max_x: record.bbox?.[2] ?? null,
    max_y: record.bbox?.[3] ?? null,
    checksum: record.checksum,
    geometry: record.geometry,
    attributes: record.attributes,
  };
}

function snapshotColumns(snapshot: CorpusSnapshot) {
  return {
    id: snapshot.id,
    source_key: snapshot.sourceKey,
    period: snapshot.period,
    status: snapshot.status,
    layer_url: snapshot.layerUrl,
    started_at: snapshot.startedAt,
    completed_at: snapshot.completedAt,
    record_count: snapshot.recordCount,
    checksum: snapshot.checksum,
    cursor: snapshot.cursor,
    payload: snapshot,
  };
}

/** PostgREST rejects very large request bodies; harvests are written in chunks. */
const WRITE_CHUNK = Number(process.env.CORPUS_WRITE_CHUNK ?? 500);

export function createSupabaseCorpusStore(url: string, key: string): CorpusStore {
  const ctx: Ctx = { url, key };

  const findSnapshot = async (sourceKey: string, period: string) => {
    const rows = await request<SnapshotRow[]>(
      ctx,
      `lm_corpus_snapshots?source_key=eq.${encodeURIComponent(sourceKey)}&period=eq.${encodeURIComponent(period)}&select=id,payload`,
    );
    return rows.length > 0 ? rows[0].payload : null;
  };

  return {
    kind: "supabase",
    ephemeral: false,

    async createSnapshot(snapshot) {
      await request(ctx, "lm_corpus_snapshots", {
        method: "POST",
        body: JSON.stringify(snapshotColumns(snapshot)),
        returning: false,
      });
      return snapshot;
    },

    async updateSnapshot(id, patch) {
      const rows = await request<SnapshotRow[]>(
        ctx,
        `lm_corpus_snapshots?id=eq.${encodeURIComponent(id)}&select=id,payload`,
      );
      if (rows.length === 0) throw new Error(`Unknown snapshot ${id}`);
      const next = { ...rows[0].payload, ...patch, id };
      await request(ctx, `lm_corpus_snapshots?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(snapshotColumns(next)),
        returning: false,
      });
      return next;
    },

    async getSnapshot(id) {
      const rows = await request<SnapshotRow[]>(
        ctx,
        `lm_corpus_snapshots?id=eq.${encodeURIComponent(id)}&select=id,payload`,
      );
      return rows.length > 0 ? rows[0].payload : null;
    },

    findSnapshot,

    async activeSnapshot(sourceKey) {
      const rows = await request<SnapshotRow[]>(
        ctx,
        `lm_corpus_snapshots?source_key=eq.${encodeURIComponent(sourceKey)}&status=eq.ACTIVE&select=id,payload&limit=1`,
      );
      return rows.length > 0 ? rows[0].payload : null;
    },

    async listSnapshots(sourceKey, limit = 50) {
      const filter = sourceKey ? `source_key=eq.${encodeURIComponent(sourceKey)}&` : "";
      const rows = await request<SnapshotRow[]>(
        ctx,
        `lm_corpus_snapshots?${filter}select=id,payload&order=period.desc&limit=${limit}`,
      );
      return rows.map((row) => row.payload);
    },

    async activate(snapshotId) {
      const target = await this.getSnapshot(snapshotId);
      if (!target) throw new Error(`Unknown snapshot ${snapshotId}`);
      // Demote first: the partial unique index guarantees at most one ACTIVE row
      // per source, so promoting before demoting would be rejected.
      const current = await this.activeSnapshot(target.sourceKey);
      if (current && current.id !== snapshotId) {
        await this.updateSnapshot(current.id, { status: "SUPERSEDED" });
      }
      await this.updateSnapshot(snapshotId, { status: "ACTIVE" });
    },

    async putRecords(records) {
      let written = 0;
      for (let i = 0; i < records.length; i += WRITE_CHUNK) {
        const chunk = records.slice(i, i + WRITE_CHUNK).map(toRow);
        await request(ctx, "lm_corpus_records", {
          method: "POST",
          body: JSON.stringify(chunk),
          returning: false,
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        });
        written += chunk.length;
      }
      return written;
    },

    async recordsInBBox(snapshotId, box) {
      const [minX, minY, maxX, maxY] = box;
      // Two boxes intersect unless one lies entirely to a side of the other.
      const query =
        `lm_corpus_records?snapshot_id=eq.${encodeURIComponent(snapshotId)}` +
        `&min_x=lte.${maxX}&max_x=gte.${minX}&min_y=lte.${maxY}&max_y=gte.${minY}` +
        `&select=*`;
      const rows = await request<RecordRow[]>(ctx, query);
      return rows.map(toRecord);
    },

    async allRecords(snapshotId) {
      const rows = await request<RecordRow[]>(
        ctx,
        `lm_corpus_records?snapshot_id=eq.${encodeURIComponent(snapshotId)}&select=*`,
      );
      return rows.map(toRecord);
    },

    async countRecords(snapshotId) {
      const response = await fetch(
        `${ctx.url.replace(/\/+$/, "")}/rest/v1/lm_corpus_records?snapshot_id=eq.${encodeURIComponent(snapshotId)}&select=external_id`,
        {
          headers: {
            apikey: ctx.key,
            Authorization: `Bearer ${ctx.key}`,
            Prefer: "count=exact",
            Range: "0-0",
          },
          cache: "no-store",
        },
      );
      const range = response.headers.get("content-range");
      const total = range?.split("/")[1];
      return total && total !== "*" ? Number(total) : 0;
    },

    async deleteRecords(snapshotId) {
      await request(ctx, `lm_corpus_records?snapshot_id=eq.${encodeURIComponent(snapshotId)}`, {
        method: "DELETE",
        returning: false,
      });
    },

    async saveWatch(watch) {
      await request(ctx, "lm_watches", {
        method: "POST",
        body: JSON.stringify({
          id: watch.id,
          created_at: watch.createdAt,
          project_id: watch.projectId,
          org_id: watch.orgId,
          active: watch.active,
          cadence: watch.cadence,
          last_reported_period: watch.lastReportedPeriod,
          payload: watch,
        }),
        returning: false,
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      });
      return watch;
    },

    async getWatch(id) {
      const rows = await request<{ payload: WatchSubscription }[]>(
        ctx,
        `lm_watches?id=eq.${encodeURIComponent(id)}&select=payload`,
      );
      return rows.length > 0 ? rows[0].payload : null;
    },

    async listWatches(activeOnly = false) {
      const filter = activeOnly ? "active=eq.true&" : "";
      const rows = await request<{ payload: WatchSubscription }[]>(
        ctx,
        `lm_watches?${filter}select=payload&order=created_at.desc`,
      );
      return rows.map((row) => row.payload);
    },

    async saveWatchReport(report) {
      await request(ctx, "lm_watch_reports", {
        method: "POST",
        body: JSON.stringify({
          id: report.id,
          generated_at: report.generatedAt,
          watch_id: report.watchId,
          project_id: report.projectId,
          period: report.period,
          change_count: report.changes.length,
          quiet: report.quiet,
          payload: report,
        }),
        returning: false,
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      });
      return report;
    },

    async getWatchReport(id) {
      const rows = await request<{ payload: WatchReport }[]>(
        ctx,
        `lm_watch_reports?id=eq.${encodeURIComponent(id)}&select=payload`,
      );
      return rows.length > 0 ? rows[0].payload : null;
    },

    async listWatchReports(watchId, limit = 24) {
      const rows = await request<{ payload: WatchReport }[]>(
        ctx,
        `lm_watch_reports?watch_id=eq.${encodeURIComponent(watchId)}&select=payload&order=period.desc&limit=${limit}`,
      );
      return rows.map((row) => row.payload);
    },
  };
}
