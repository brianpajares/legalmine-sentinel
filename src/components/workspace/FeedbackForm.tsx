"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui/Primitives";
import { track } from "@/lib/analytics/client";

/**
 * Pilot feedback form (Plan Maestro §13.3).
 *
 * These answers are the only input to the traction figures on the landing page,
 * which is why the baseline time is asked for rather than assumed.
 */
export default function FeedbackForm({
  assessmentId,
  projectId,
}: {
  assessmentId: string;
  projectId: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          projectId,
          roleOrCompanyType: form.get("role"),
          manualBaselineMinutes: numberOrUndefined(form.get("baseline")),
          legalmineMinutes: numberOrUndefined(form.get("elapsed")),
          usefulness: Number(form.get("usefulness")),
          trust: Number(form.get("trust")),
          mostValuableFactor: form.get("valuable"),
          missingData: form.get("missing"),
          wouldUseAgain: form.get("again") === "on",
          wtpHypothesis: form.get("wtp"),
          permissionToQuote: form.get("quotable") === "on",
          quote: form.get("quote"),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "The response could not be saved.");
        setState("error");
        return;
      }
      track("pilot_feedback_submitted", {
        usefulness: Number(form.get("usefulness")),
        would_use_again: form.get("again") === "on",
      });
      setState("sent");
    } catch {
      setError("Network error. The response was not saved.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <Panel className="p-6">
        <p className="flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Feedback recorded. It now counts towards the validation metrics on the public page.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="p-5">
      <PanelHeader
        title="Pilot feedback"
        subtitle="Two minutes. Measured, not estimated — the baseline you give here is what the time-saved figure is computed from."
      />

      <form onSubmit={submit} className="mt-5 grid gap-4">
        <Field label="Your role or company type" required>
          <input
            name="role"
            required
            placeholder="e.g. Exploration Manager, mid-tier miner"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How long does this screening take you manually? (minutes)">
            <input name="baseline" inputMode="numeric" placeholder="e.g. 240" className={inputClass} />
          </Field>
          <Field label="How long did it take here? (minutes)">
            <input name="elapsed" inputMode="numeric" placeholder="e.g. 8" className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Usefulness (1–5)" required>
            <select name="usefulness" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trust in the result (1–5)" required>
            <select name="trust" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Most valuable factor">
          <input name="valuable" className={inputClass} />
        </Field>

        <Field label="What data was missing for a real case?">
          <textarea name="missing" rows={2} className={inputClass} />
        </Field>

        <Field label="What would you expect to pay, and per what unit?">
          <input
            name="wtp"
            placeholder="e.g. per project, per seat, annual"
            className={inputClass}
          />
        </Field>

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input name="again" type="checkbox" className="rounded border-white/20 bg-white/5" />
          I would use this on another asset
        </label>

        <Field label="Anything we may quote publicly">
          <textarea name="quote" rows={2} className={inputClass} />
        </Field>

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input name="quotable" type="checkbox" className="rounded border-white/20 bg-white/5" />
          You may attribute that quote to me and my company
        </label>

        {state === "error" ? <p className="text-xs text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {state === "sending" ? "Saving…" : "Submit feedback"}
        </button>
      </form>
    </Panel>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-blue-500";

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-gray-400">
      {label}
      {required ? <span className="ml-0.5 text-red-400">*</span> : null}
      {children}
    </label>
  );
}

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}
