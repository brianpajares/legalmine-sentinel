import { describe, expect, it } from "vitest";

import { headline, runAssessment } from "@/lib/scoring/engine";
import { RULE_VERSION } from "@/lib/rules/v1";
import type { ReinfoRecord } from "@/lib/sources/reinfo";
import type { MiningRightRecord } from "@/lib/sources/ingemmet";
import type { ProtectedAreaRecord } from "@/lib/sources/sernanp";

import { emptySource, GEOMETRY_SUMMARY, makeBundle } from "./fixtures";

function run(bundle = makeBundle()) {
  return runAssessment({
    projectId: "prj_test",
    projectName: "Test project",
    geometrySummary: GEOMETRY_SUMMARY,
    bundle,
  });
}

describe("determinism (Plan Maestro §18.1)", () => {
  it("produces identical scores, factors and rule version across repeated runs", () => {
    const bundle = makeBundle();
    const runs = [run(bundle), run(bundle), run(bundle)];

    for (const assessment of runs) {
      expect(assessment.ruleVersion).toBe(runs[0].ruleVersion);
      expect(assessment.overallRisk).toBe(runs[0].overallRisk);
      expect(assessment.confidence).toBe(runs[0].confidence);
      expect(assessment.factors.map((f) => [f.factorKey, f.factorScore, f.contribution])).toEqual(
        runs[0].factors.map((f) => [f.factorKey, f.factorScore, f.contribution]),
      );
    }
  });

  it("rebuilds the same bundle from the same inputs, so two independent runs agree", () => {
    expect(run(makeBundle()).overallRisk).toBe(run(makeBundle()).overallRisk);
  });

  it("rejects an unknown rule version instead of silently falling back", () => {
    expect(() =>
      runAssessment({
        projectId: "prj_test",
        projectName: "Test project",
        geometrySummary: GEOMETRY_SUMMARY,
        bundle: makeBundle(),
        ruleVersion: "9999.99-vX",
      }),
    ).toThrow(/Unknown rule version/);
  });
});

describe("score composition", () => {
  it("sums factor contributions to the overall score", () => {
    const assessment = run();
    const total = assessment.factors.reduce((sum, factor) => sum + factor.contribution, 0);
    expect(total).toBeCloseTo(assessment.overallRisk, 1);
  });

  it("sums dimension contributions to the overall score", () => {
    const assessment = run();
    const total = assessment.dimensions.reduce((sum, d) => sum + d.contribution, 0);
    expect(total).toBeCloseTo(assessment.overallRisk, 1);
  });

  it("keeps the overall score inside 0-100", () => {
    const assessment = run();
    expect(assessment.overallRisk).toBeGreaterThanOrEqual(0);
    expect(assessment.overallRisk).toBeLessThanOrEqual(100);
  });

  it("redistributes the weight of dimensions that could not be evaluated", () => {
    const assessment = run();
    const applied = assessment.dimensions
      .filter((d) => !d.inconclusive)
      .reduce((sum, d) => sum + d.effectiveWeight, 0);
    expect(applied).toBeCloseTo(1, 4);
    for (const dimension of assessment.dimensions.filter((d) => d.inconclusive)) {
      expect(dimension.effectiveWeight).toBe(0);
      expect(dimension.contribution).toBe(0);
    }
  });

  it("stamps the current rule version on the result", () => {
    expect(run().ruleVersion).toBe(RULE_VERSION);
  });
});

describe("no fabrication when a source fails (Plan Maestro §18.1)", () => {
  it("marks protected-area factors inconclusive and records the gap when SERNANP is unavailable", () => {
    const assessment = run(
      makeBundle({ protectedAreas: emptySource<ProtectedAreaRecord>("sernanp", "UNAVAILABLE") }),
    );

    const environmental = assessment.factors.filter((f) => f.dimension === "environmental");
    expect(environmental.length).toBeGreaterThan(0);
    for (const factor of environmental) {
      expect(factor.inconclusive).toBe(true);
      expect(factor.contribution).toBe(0);
      expect(factor.dataStatus).toBe("UNAVAILABLE");
    }
    expect(assessment.missingChecks.map((c) => c.key)).toContain("protected_area_overlap");
    expect(assessment.status).toBe("PARTIAL");
  });

  it("lowers data confidence when a source drops out", () => {
    const healthy = run();
    const degraded = run(
      makeBundle({ protectedAreas: emptySource<ProtectedAreaRecord>("sernanp", "UNAVAILABLE") }),
    );
    expect(degraded.confidence).toBeLessThan(healthy.confidence);
    expect(degraded.confidenceBreakdown.completeness).toBeLessThan(
      healthy.confidenceBreakdown.completeness,
    );
  });

  it("never derives REINFO registration status from the risk score", () => {
    const assessment = run();
    const reinfo = assessment.factors.find((f) => f.factorKey === "reinfo_registration_check");
    expect(reinfo).toBeDefined();
    expect(reinfo?.inconclusive).toBe(true);
    expect(reinfo?.dataStatus).toBe("MANUAL_VERIFICATION_REQUIRED");
    expect(assessment.missingChecks.map((c) => c.key)).toContain("reinfo_registration_check");
  });

  it("does not conclude illegality when REINFO returns no record", () => {
    const reinfo = emptySource<ReinfoRecord>("reinfo", "OK");
    const assessment = run(makeBundle({ reinfo }));
    const factor = assessment.factors.find((f) => f.factorKey === "reinfo_registration_check");
    expect(factor?.inconclusive).toBe(false);
    expect(factor?.rationale.toLowerCase()).toContain("not a finding of illegality");
  });

  it("reports COMPLETED only when both P0 sources answered", () => {
    expect(run().status).toBe("COMPLETED");
    expect(
      run(makeBundle({ miningRights: emptySource<MiningRightRecord>("ingemmet", "NOT_CONFIGURED") }))
        .status,
    ).toBe("PARTIAL");
  });
});

describe("evidence traceability (Plan Maestro §10.2)", () => {
  it("attaches at least one resolvable evidence record to every scored factor", () => {
    const assessment = run();
    const ids = new Set(assessment.evidence.map((e) => e.id));
    const scored = assessment.factors.filter((f) => !f.inconclusive);

    expect(scored.length).toBeGreaterThan(0);
    for (const factor of scored) {
      expect(factor.evidenceIds.length).toBeGreaterThan(0);
      for (const id of factor.evidenceIds) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });

  it("gives every factor a rationale and a stable rule id", () => {
    for (const factor of run().factors) {
      expect(factor.rationale.trim().length).toBeGreaterThan(20);
      expect(factor.ruleId).toMatch(/^[A-Z]+-[A-Z0-9]+-\d+$/);
    }
  });

  it("keeps every missing check paired with a blocked conclusion and an action", () => {
    for (const check of run().missingChecks) {
      expect(check.blockedConclusion.trim().length).toBeGreaterThan(20);
      expect(check.suggestedAction.trim().length).toBeGreaterThan(10);
    }
  });
});

describe("screening language (Plan Maestro §7.6)", () => {
  it("never asserts illegality or guaranteed viability in generated text", () => {
    const assessment = run();
    const generated = [
      ...assessment.factors.map((f) => `${f.rationale} ${f.nextStep ?? ""}`),
      ...assessment.missingChecks.map((c) => `${c.reason} ${c.blockedConclusion} ${c.suggestedAction}`),
    ]
      .join(" ")
      .toLowerCase();

    for (const banned of [
      "is illegal",
      "guarantees",
      "legally viable",
      "safe zone",
      "approved to operate",
      "proves illegal mining",
    ]) {
      expect(generated).not.toContain(banned);
    }
  });
});

describe("unmeasured is not the same as low risk", () => {
  it("reports NOT_ASSESSED rather than LOW when no dimension could be evaluated", () => {
    const assessment = run(
      makeBundle({
        miningRights: emptySource<MiningRightRecord>("ingemmet", "NOT_CONFIGURED"),
        protectedAreas: emptySource<ProtectedAreaRecord>("sernanp", "NOT_CONFIGURED"),
      }),
    );

    expect(assessment.factors.every((f) => f.inconclusive)).toBe(true);
    expect(assessment.overallRisk).toBe(0);
    expect(assessment.riskLevel).toBe("NOT_ASSESSED");
    expect(assessment.confidence).toBe(0);
    expect(assessment.status).toBe("PARTIAL");
  });

  it("says so in the headline instead of describing the area as low risk", () => {
    const assessment = run(
      makeBundle({
        miningRights: emptySource<MiningRightRecord>("ingemmet", "UNAVAILABLE"),
        protectedAreas: emptySource<ProtectedAreaRecord>("sernanp", "UNAVAILABLE"),
      }),
    );
    const text = headline(assessment).toLowerCase();
    expect(text).toContain("no screening risk could be calculated");
    expect(text).not.toContain("low preliminary screening risk");
  });
});
