/**
 * Funnel instrumentation (Plan Maestro §12.1).
 *
 * Events go to PostHog when NEXT_PUBLIC_POSTHOG_KEY is configured, and nowhere
 * otherwise. There is deliberately no local fallback that pretends to record
 * analytics: an unconfigured deployment reports zero events rather than
 * synthetic ones. Business metrics shown to users come from stored records
 * (assessments, dossiers, feedback), not from this stream.
 */

export type AnalyticsEvent =
  | "landing_view"
  | "launch_app_clicked"
  | "assessment_started"
  | "investor_demo_kml_loaded"
  | "geometry_uploaded"
  | "source_check_completed"
  | "assessment_completed"
  | "factor_opened"
  | "report_generated"
  | "report_saved_to_drive"
  | "pilot_feedback_submitted"
  | "request_pilot_clicked"
  | "pricing_view"
  | "plan_selected";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/** Stable per-browser id so the funnel can be counted without any personal data. */
function distinctId(): string {
  if (typeof window === "undefined") return "server";
  const storageKey = "legalmine_distinct_id";
  let id = window.localStorage.getItem(storageKey);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(storageKey, id);
  }
  return id;
}

export function analyticsEnabled(): boolean {
  return Boolean(KEY);
}

export function track(event: AnalyticsEvent, properties: Record<string, unknown> = {}): void {
  if (!KEY || typeof window === "undefined") return;
  const payload = JSON.stringify({
    api_key: KEY,
    event,
    distinct_id: distinctId(),
    properties: { ...properties, $current_url: window.location.href },
    timestamp: new Date().toISOString(),
  });

  // keepalive lets the request survive a navigation triggered by the same click.
  void fetch(`${HOST.replace(/\/+$/, "")}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Analytics must never break the product flow.
  });
}
