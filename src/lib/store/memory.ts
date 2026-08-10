import type { Assessment, Lead, PilotFeedback, Project } from "@/types/assessment";
import { mean, median, type Store, type TractionMetrics } from "./index";

interface MemoryState {
  projects: Map<string, Project>;
  assessments: Map<string, Assessment>;
  feedback: PilotFeedback[];
  leads: Lead[];
  reportsGenerated: Set<string>;
}

/**
 * Survives module reloads in dev, but not a process restart or a new serverless
 * instance. Callers must treat `ephemeral: true` as a real limitation.
 */
function state(): MemoryState {
  const globalRef = globalThis as typeof globalThis & { __legalmineStore?: MemoryState };
  if (!globalRef.__legalmineStore) {
    globalRef.__legalmineStore = {
      projects: new Map(),
      assessments: new Map(),
      feedback: [],
      leads: [],
      reportsGenerated: new Set(),
    };
  }
  return globalRef.__legalmineStore;
}

function byNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function createMemoryStore(): Store {
  return {
    kind: "memory",
    ephemeral: true,

    async saveProject(project) {
      state().projects.set(project.id, project);
      return project;
    },
    async getProject(id) {
      return state().projects.get(id) ?? null;
    },
    async listProjects(limit = 50) {
      return byNewest([...state().projects.values()]).slice(0, limit);
    },

    async saveAssessment(assessment) {
      state().assessments.set(assessment.id, assessment);
      return assessment;
    },
    async getAssessment(id) {
      return state().assessments.get(id) ?? null;
    },
    async listAssessments(limit = 50) {
      return byNewest([...state().assessments.values()]).slice(0, limit);
    },
    async recordReportGenerated(assessmentId) {
      state().reportsGenerated.add(assessmentId);
    },

    async saveFeedback(feedback) {
      state().feedback.push(feedback);
      return feedback;
    },
    async listFeedback(limit = 100) {
      return byNewest(state().feedback).slice(0, limit);
    },

    async saveLead(lead) {
      state().leads.push(lead);
      return lead;
    },
    async listLeads(limit = 100) {
      return byNewest(state().leads).slice(0, limit);
    },

    async metrics(): Promise<TractionMetrics> {
      const s = state();
      const assessments = [...s.assessments.values()];
      const feedback = s.feedback;
      const timeSaved = feedback
        .filter((f) => f.manualBaselineMinutes != null && f.legalmineMinutes != null)
        .map((f) => (f.manualBaselineMinutes as number) - (f.legalmineMinutes as number))
        .filter((n) => Number.isFinite(n));
      return {
        projects: s.projects.size,
        assessments: assessments.length,
        reportsGenerated: s.reportsGenerated.size,
        pilotFeedback: feedback.length,
        leads: s.leads.length,
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
