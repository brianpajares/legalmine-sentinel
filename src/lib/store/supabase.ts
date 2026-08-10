import type { Assessment, Lead, PilotFeedback, Project } from "@/types/assessment";
import { mean, median, type Store, type TractionMetrics } from "./index";

/**
 * Durable store backed by Supabase PostgREST.
 *
 * Written against the HTTP API rather than the JS client so the deployment
 * carries no extra dependency. Apply `supabase/migrations/0001_init.sql`
 * before pointing a deployment at a project.
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

interface Row<T> {
  id: string;
  created_at: string;
  payload: T;
}

function unwrapOne<T>(rows: Row<T>[]): T | null {
  return rows.length > 0 ? rows[0].payload : null;
}

export function createSupabaseStore(url: string, key: string): Store {
  const ctx: Ctx = { url, key };

  const insert = async <T extends { id: string; createdAt: string }>(
    table: string,
    entity: T,
    extra: Record<string, unknown> = {},
  ): Promise<T> => {
    await request(ctx, table, {
      method: "POST",
      body: JSON.stringify({
        id: entity.id,
        created_at: entity.createdAt,
        payload: entity,
        ...extra,
      }),
      returning: false,
      headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    });
    return entity;
  };

  const selectAll = async <T>(table: string, limit: number): Promise<T[]> => {
    const rows = await request<Row<T>[]>(
      ctx,
      `${table}?select=payload,created_at&order=created_at.desc&limit=${limit}`,
      { method: "GET" },
    );
    return rows.map((row) => row.payload);
  };

  return {
    kind: "supabase",
    ephemeral: false,

    async saveProject(project) {
      return insert("lm_projects", project, {
        name: project.name,
        geometry_hash: project.geometrySummary.geometryHash,
        demo: project.demo,
      });
    },
    async getProject(id) {
      const rows = await request<Row<Project>[]>(
        ctx,
        `lm_projects?select=payload,created_at&id=eq.${encodeURIComponent(id)}&limit=1`,
        { method: "GET" },
      );
      return unwrapOne(rows);
    },
    async listProjects(limit = 50) {
      return selectAll<Project>("lm_projects", limit);
    },

    async saveAssessment(assessment) {
      return insert("lm_assessments", assessment, {
        project_id: assessment.projectId,
        rule_version: assessment.ruleVersion,
        overall_risk: assessment.overallRisk,
        confidence: assessment.confidence,
        assessment_status: assessment.status,
      });
    },
    async getAssessment(id) {
      const rows = await request<Row<Assessment>[]>(
        ctx,
        `lm_assessments?select=payload,created_at&id=eq.${encodeURIComponent(id)}&limit=1`,
        { method: "GET" },
      );
      return unwrapOne(rows);
    },
    async listAssessments(limit = 50) {
      return selectAll<Assessment>("lm_assessments", limit);
    },
    async recordReportGenerated(assessmentId) {
      await request(ctx, "lm_report_events", {
        method: "POST",
        body: JSON.stringify({
          assessment_id: assessmentId,
          created_at: new Date().toISOString(),
        }),
        returning: false,
        headers: { Prefer: "return=minimal" },
      });
    },

    async saveFeedback(feedback) {
      return insert("lm_pilot_feedback", feedback, {
        assessment_id: feedback.assessmentId ?? null,
        usefulness: feedback.usefulness,
        would_use_again: feedback.wouldUseAgain,
      });
    },
    async listFeedback(limit = 100) {
      return selectAll<PilotFeedback>("lm_pilot_feedback", limit);
    },

    async saveLead(lead) {
      return insert("lm_leads", lead, { email: lead.email, lead_source: lead.source });
    },
    async listLeads(limit = 100) {
      return selectAll<Lead>("lm_leads", limit);
    },

    async metrics(): Promise<TractionMetrics> {
      const [projects, assessments, feedback, leads, reportRows] = await Promise.all([
        selectAll<Project>("lm_projects", 1000),
        selectAll<Assessment>("lm_assessments", 1000),
        selectAll<PilotFeedback>("lm_pilot_feedback", 1000),
        selectAll<Lead>("lm_leads", 1000),
        request<{ assessment_id: string }[]>(
          ctx,
          "lm_report_events?select=assessment_id&limit=1000",
          { method: "GET" },
        ).catch(() => [] as { assessment_id: string }[]),
      ]);

      const timeSaved = feedback
        .filter((f) => f.manualBaselineMinutes != null && f.legalmineMinutes != null)
        .map((f) => (f.manualBaselineMinutes as number) - (f.legalmineMinutes as number))
        .filter((n) => Number.isFinite(n));

      return {
        projects: projects.length,
        assessments: assessments.length,
        reportsGenerated: new Set(reportRows.map((r) => r.assessment_id)).size,
        pilotFeedback: feedback.length,
        leads: leads.length,
        averageConfidence: mean(assessments.map((a) => a.confidence)),
        medianAssessmentSeconds: median(assessments.map((a) => a.durationMs / 1000)),
        wouldUseAgain: {
          yes: feedback.filter((f) => f.wouldUseAgain).length,
          total: feedback.length,
        },
        medianTimeSavedMinutes: median(timeSaved),
      };
    },
  };
}
