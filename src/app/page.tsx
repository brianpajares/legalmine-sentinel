import Landing from "@/components/landing/Landing";
import { getStore, type TractionMetrics } from "@/lib/store";
import { isDemoMode } from "@/lib/sources/config";
import { RULE_VERSION } from "@/lib/rules/v1";

export const dynamic = "force-dynamic";

const EMPTY_METRICS: TractionMetrics = {
  projects: 0,
  assessments: 0,
  reportsGenerated: 0,
  pilotFeedback: 0,
  leads: 0,
  averageConfidence: null,
  medianAssessmentSeconds: null,
  wouldUseAgain: { yes: 0, total: 0 },
  medianTimeSavedMinutes: null,
};

export default async function HomePage() {
  // A storage outage must not take the marketing site down, and it must not
  // invent numbers either: the traction section falls back to explicit zeros.
  let metrics = EMPTY_METRICS;
  try {
    const store = await getStore();
    metrics = await store.metrics();
  } catch {
    metrics = EMPTY_METRICS;
  }

  return <Landing metrics={metrics} demoMode={isDemoMode()} ruleVersion={RULE_VERSION} />;
}
