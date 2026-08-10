import { beforeEach, describe, expect, it } from "vitest";

import type { CorpusRecord, CorpusSnapshot } from "@/types/corpus";
import type { GeoGeometry } from "@/types/geo";
import { createMemoryCorpusStore, __setCorpusStore, type CorpusStore } from "@/lib/corpus/store";
import { finalizeSnapshot, recordChecksum } from "@/lib/corpus/ingest";
import { changesTouching, diffSnapshots } from "@/lib/corpus/diff";
import { queryCorpusMiningRights } from "@/lib/corpus/query";
import { bboxIntersects, isPeriod, periodOf, previousPeriod } from "@/lib/corpus/period";
import { bbox as bboxOf } from "@/lib/geo/measure";

import { AOI } from "./fixtures";

/** A concession overlapping the eastern half of the standard AOI. */
const INSIDE: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-69.84, -12.9],
      [-69.8, -12.9],
      [-69.8, -12.93],
      [-69.84, -12.93],
      [-69.84, -12.9],
    ],
  ],
};

/** Far enough away that no bounding box can touch the AOI. */
const OUTSIDE: GeoGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-60.0, -5.0],
      [-59.9, -5.0],
      [-59.9, -5.1],
      [-60.0, -5.1],
      [-60.0, -5.0],
    ],
  ],
};

let store: CorpusStore;

function snapshot(period: string, id: string): CorpusSnapshot {
  return {
    id,
    sourceKey: "ingemmet",
    period,
    status: "BUILDING",
    layerUrl: "https://example.test/MapServer/0",
    startedAt: `${period}-01T00:00:00.000Z`,
    completedAt: null,
    recordCount: 0,
    checksum: null,
    coverage: null,
    cursor: 0,
    warnings: [],
  };
}

function record(
  snapshotId: string,
  externalId: string,
  geometry: GeoGeometry,
  attributes: Record<string, unknown>,
): CorpusRecord {
  return {
    snapshotId,
    sourceKey: "ingemmet",
    externalId,
    geometry,
    bbox: bboxOf(geometry),
    attributes,
    checksum: recordChecksum(attributes, geometry),
  };
}

beforeEach(() => {
  store = createMemoryCorpusStore();
  __setCorpusStore(store);
});

describe("periods", () => {
  it("rolls back across a year boundary", () => {
    expect(previousPeriod("2026-01")).toBe("2025-12");
    expect(previousPeriod("2026-08")).toBe("2026-07");
  });

  it("rejects anything that is not YYYY-MM", () => {
    expect(isPeriod("2026-08")).toBe(true);
    expect(isPeriod("2026-13")).toBe(false);
    expect(isPeriod("2026-8")).toBe(false);
    expect(isPeriod("august")).toBe(false);
  });
});

describe("snapshot sealing", () => {
  it("computes a checksum that is independent of harvest order", async () => {
    const a = await store.createSnapshot(snapshot("2026-07", "snap_a"));
    await store.putRecords([
      record(a.id, "R-001", INSIDE, { code: "R-001", status: "TITULADO" }),
      record(a.id, "R-002", OUTSIDE, { code: "R-002", status: "EN TRAMITE" }),
    ]);
    const sealedA = await finalizeSnapshot(a.id);

    const b = await store.createSnapshot(snapshot("2026-08", "snap_b"));
    await store.putRecords([
      record(b.id, "R-002", OUTSIDE, { code: "R-002", status: "EN TRAMITE" }),
      record(b.id, "R-001", INSIDE, { code: "R-001", status: "TITULADO" }),
    ]);
    const sealedB = await finalizeSnapshot(b.id);

    expect(sealedA.checksum).toBe(sealedB.checksum);
    expect(sealedA.recordCount).toBe(2);
  });

  it("keeps exactly one active snapshot per source", async () => {
    const a = await store.createSnapshot(snapshot("2026-07", "snap_a"));
    await store.putRecords([record(a.id, "R-001", INSIDE, { code: "R-001" })]);
    await finalizeSnapshot(a.id);

    const b = await store.createSnapshot(snapshot("2026-08", "snap_b"));
    await store.putRecords([record(b.id, "R-001", INSIDE, { code: "R-001" })]);
    await finalizeSnapshot(b.id);

    const active = await store.activeSnapshot("ingemmet");
    expect(active?.period).toBe("2026-08");
    expect((await store.getSnapshot("snap_a"))?.status).toBe("SUPERSEDED");
  });
});

describe("diffing two months", () => {
  async function buildPair() {
    const july = await store.createSnapshot(snapshot("2026-07", "snap_jul"));
    await store.putRecords([
      record(july.id, "R-001", INSIDE, { code: "R-001", status: "EN TRAMITE" }),
      record(july.id, "R-GONE", INSIDE, { code: "R-GONE", status: "TITULADO" }),
    ]);
    await finalizeSnapshot(july.id);

    const august = await store.createSnapshot(snapshot("2026-08", "snap_aug"));
    await store.putRecords([
      // status changed
      record(august.id, "R-001", INSIDE, { code: "R-001", status: "TITULADO" }),
      // brand new, and outside the AOI
      record(august.id, "R-NEW", OUTSIDE, { code: "R-NEW", status: "TITULADO" }),
    ]);
    await finalizeSnapshot(august.id);
  }

  it("classifies additions, removals and modifications", async () => {
    await buildPair();
    const changes = await diffSnapshots("ingemmet", "2026-08", "2026-07");

    const byId = Object.fromEntries(changes.map((c) => [c.externalId, c]));
    expect(byId["R-001"].changeType).toBe("MODIFIED");
    expect(byId["R-001"].changedFields).toEqual(["status"]);
    expect(byId["R-NEW"].changeType).toBe("ADDED");
    expect(byId["R-GONE"].changeType).toBe("REMOVED");
  });

  it("reports nothing when a period was never harvested", async () => {
    const august = await store.createSnapshot(snapshot("2026-08", "snap_aug"));
    await store.putRecords([record(august.id, "R-001", INSIDE, { code: "R-001" })]);
    await finalizeSnapshot(august.id);

    // July is missing, which is unknown — not "everything was added".
    expect(await diffSnapshots("ingemmet", "2026-08", "2026-07")).toEqual([]);
  });

  it("keeps only the changes that touch the area of interest", async () => {
    await buildPair();
    const changes = await diffSnapshots("ingemmet", "2026-08", "2026-07");
    const touching = changesTouching(AOI, changes);

    expect(touching.map((c) => c.externalId).sort()).toEqual(["R-001", "R-GONE"]);
  });
});

describe("querying the corpus for an area of interest", () => {
  it("returns overlapping rights with their computed overlap", async () => {
    const august = await store.createSnapshot(snapshot(periodOf(), "snap_now"));
    await store.putRecords([
      record(august.id, "R-001", INSIDE, {
        code: "R-001",
        name: "Concesión Test",
        status: "TITULADO",
        holder: "Titular SA",
        substance: "Oro",
        declaredHectares: 100,
        raw: {},
      }),
      record(august.id, "R-FAR", OUTSIDE, { code: "R-FAR", raw: {} }),
    ]);
    await finalizeSnapshot(august.id);

    const { result, basis } = await queryCorpusMiningRights(AOI);

    expect(result.status).toBe("OK");
    expect(result.records).toHaveLength(1);
    expect(result.records[0].code).toBe("R-001");
    expect(result.records[0].overlapHectares).toBeGreaterThan(0);
    expect(basis?.period).toBe(periodOf());
    expect(result.warnings.join(" ")).toContain("snapshot");
  });

  it("reports NOT_CONFIGURED rather than an empty result when nothing was harvested", async () => {
    const { result, basis } = await queryCorpusMiningRights(AOI);

    // The distinction that matters: "we have no data" must never render as
    // "no overlapping concessions found".
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.records).toEqual([]);
    expect(basis).toBeNull();
  });

  it("flags a snapshot older than a month as stale", async () => {
    const stale = await store.createSnapshot(snapshot("2020-01", "snap_old"));
    await store.putRecords([record(stale.id, "R-001", INSIDE, { code: "R-001", raw: {} })]);
    await finalizeSnapshot(stale.id);

    const { result } = await queryCorpusMiningRights(AOI);
    expect(result.status).toBe("STALE");
    expect(result.warnings.join(" ")).toContain("older than one month");
  });
});

describe("bounding-box prefilter", () => {
  it("only accepts boxes that genuinely meet", () => {
    const aoiBox = bboxOf(AOI);
    expect(bboxIntersects(aoiBox, bboxOf(INSIDE))).toBe(true);
    expect(bboxIntersects(aoiBox, bboxOf(OUTSIDE))).toBe(false);
  });
});
