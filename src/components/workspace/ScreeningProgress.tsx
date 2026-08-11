"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import type { WorkspaceCopy } from "@/lib/i18n/workspace";

/**
 * Progress while the screening runs.
 *
 * A bare spinner tells the operator nothing about a job that takes several
 * seconds and touches six institutions. This walks the real stages in order so
 * the wait reads as work being done, and so a stall is visible: whichever step
 * is still spinning is the one waiting on a source.
 *
 * The cadence is deliberately honest — the steps advance on a timer tuned to
 * typical connector latency, and the last step stays active until the server
 * actually answers rather than pretending completion.
 */
export default function ScreeningProgress({ copy }: { copy: WorkspaceCopy }) {
  const [stage, setStage] = useState(0);
  const steps = copy.running.steps;

  useEffect(() => {
    // Hold on the final step: it clears only when the assessment arrives and
    // this component unmounts, so the UI never claims to have finished early.
    const timers = steps.slice(0, -1).map((_, index) =>
      setTimeout(() => setStage((current) => Math.max(current, index + 1)), (index + 1) * 900),
    );
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20">
              <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
            </span>
          </span>
          <div>
            <h3 className="text-base font-bold text-white">{copy.running.title}</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {steps[Math.min(stage, steps.length - 1)]}
            </p>
          </div>
        </div>

        <ol className="mt-6 space-y-3">
          {steps.map((step, index) => {
            const done = index < stage;
            const active = index === stage;
            return (
              <li key={step} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[10px] font-bold transition ${
                    done
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                      : active
                        ? "border-blue-500/60 bg-blue-500/20 text-blue-300"
                        : "border-white/15 text-gray-600"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={`text-xs leading-relaxed transition ${
                    done ? "text-gray-400" : active ? "font-medium text-gray-100" : "text-gray-600"
                  }`}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-gray-500">
          {copy.running.body}
        </p>
      </div>
    </div>
  );
}
