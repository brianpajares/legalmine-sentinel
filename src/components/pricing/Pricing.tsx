"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ShieldAlert } from "lucide-react";

import { PLANS, PRICING_NOTE, type Plan } from "@/lib/billing/plans";
import { track } from "@/lib/analytics/client";

export default function Pricing({ payablePlanIds }: { payablePlanIds: string[] }) {
  const [selected, setSelected] = useState<Plan | null>(null);

  useEffect(() => {
    track("pricing_view");
  }, []);

  return (
    <div className="min-h-screen bg-[#070a13] text-gray-200">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <ShieldAlert className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-bold uppercase tracking-wider text-white">
              LegalMine <span className="text-blue-400">Sentinel</span>
            </span>
          </Link>
          <Link
            href="/app"
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Open the app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-14">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Priced per screening team, not per map
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
            Every plan includes the full evidence chain: official connectors, the versioned rule
            engine, the factor-by-factor breakdown and the exportable dossier. What changes is how
            many people use it and how far it is configured for your jurisdictions.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              payable={payablePlanIds.includes(plan.id)}
              onSelect={() => {
                track("plan_selected", { plan: plan.id });
                setSelected(plan);
              }}
            />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-xs leading-relaxed text-gray-400">
          {PRICING_NOTE}
        </p>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "What you are paying for",
              body: "Normalized records across sources, a rule library you can audit and version, an evidence graph behind every number, and a report a committee can act on.",
            },
            {
              title: "What we will not sell you",
              body: "A legal opinion, a guarantee of viability, or a claim that a government database is synced in real time when it is not. The product's language is constrained on purpose.",
            },
            {
              title: "How pilots work",
              body: "Bring a live area of interest. We run it with you, hand over the dossier, and ask for structured feedback. No card, no commitment, and your polygon is not published anywhere.",
            },
          ].map((item) => (
            <div key={item.title} className="glass-panel p-5">
              <h3 className="text-sm font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">{item.body}</p>
            </div>
          ))}
        </section>
      </main>

      {selected ? <PlanDialog plan={selected} payablePlanIds={payablePlanIds} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function PlanCard({
  plan,
  payable,
  onSelect,
}: {
  plan: Plan;
  payable: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        plan.highlighted
          ? "border-blue-500/50 bg-blue-500/[0.07] shadow-lg shadow-blue-500/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {plan.highlighted ? (
        <span className="mb-3 w-fit rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Most teams start here
        </span>
      ) : null}
      <h2 className="text-sm font-bold uppercase tracking-wider text-white">{plan.name}</h2>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{plan.price}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {plan.cadence}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-gray-400">{plan.tagline}</p>

      <ul className="mt-5 flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-gray-300">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        className={`mt-6 w-full rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
          plan.highlighted
            ? "bg-blue-600 text-white hover:bg-blue-500"
            : "border border-white/15 text-gray-200 hover:bg-white/5"
        }`}
      >
        {plan.cta}
      </button>
      {!payable && plan.stripePriceEnv ? (
        <p className="mt-2 text-center text-[10px] text-gray-500">
          Self-serve checkout is not enabled yet — we will set this up with you directly.
        </p>
      ) : null}
    </div>
  );
}

function PlanDialog({
  plan,
  payablePlanIds,
  onClose,
}: {
  plan: Plan;
  payablePlanIds: string[];
  onClose: () => void;
}) {
  const [state, setState] = useState<"idle" | "working" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const payable = payablePlanIds.includes(plan.id);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    setState("working");

    // A lead is always recorded first, so a failed or abandoned checkout still
    // reaches a human instead of disappearing.
    const leadResponse = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        company: form.get("company"),
        role: form.get("role"),
        plan: plan.id,
        message: form.get("message"),
        source: "pricing_page",
      }),
    }).catch(() => null);

    if (!leadResponse?.ok) {
      const body = (await leadResponse?.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "That request could not be saved. Check the email address.");
      setState("error");
      return;
    }

    if (payable) {
      const checkout = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, email }),
      }).catch(() => null);
      const payload = (await checkout?.json().catch(() => null)) as { url?: string } | null;
      if (checkout?.ok && payload?.url) {
        window.location.href = payload.url;
        return;
      }
      // Checkout failed after the lead was stored: say so plainly rather than
      // leaving the user on a spinner.
      setMessage(
        "Your request was recorded, but the payment page could not be opened. We will follow up by email.",
      );
      setState("sent");
      return;
    }

    setState("sent");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0f19] p-6 shadow-2xl">
        <h3 className="text-sm font-bold text-white">
          {plan.name} · {plan.price}{" "}
          <span className="font-normal text-gray-500">{plan.cadence}</span>
        </h3>

        {state === "sent" ? (
          <>
            <p className="mt-4 text-xs leading-relaxed text-emerald-200">
              {message || "Request received. We will reply to the address you provided."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-gray-200 transition hover:bg-white/5"
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="Work email"
              className={inputClass}
            />
            <input name="company" placeholder="Company" className={inputClass} />
            <input name="role" placeholder="Role" className={inputClass} />
            <textarea
              name="message"
              rows={3}
              placeholder="What are you evaluating right now?"
              className={inputClass}
            />
            {state === "error" ? <p className="text-xs text-red-300">{message}</p> : null}
            <button
              type="submit"
              disabled={state === "working"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {state === "working" ? "Working…" : payable ? "Continue to payment" : plan.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <p className="text-[10px] leading-relaxed text-gray-500">
              We store your email, company and role to reply to this request. Areas of interest you
              upload are never published or shared.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-blue-500";
