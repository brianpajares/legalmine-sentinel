"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Globe2,
  Layers,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import type { SourceHealth } from "@/types/sources";
import type { TractionMetrics } from "@/lib/store";
import { LANDING_COPY, type Language } from "@/lib/i18n/landing";
import { StatusBadge } from "@/components/ui/Primitives";
import { track } from "@/lib/analytics/client";

interface LandingProps {
  metrics: TractionMetrics;
  demoMode: boolean;
  ruleVersion: string;
}

export default function Landing({ metrics, demoMode, ruleVersion }: LandingProps) {
  const [language, setLanguage] = useState<Language>("es");
  const copy = LANDING_COPY[language];

  useEffect(() => {
    track("landing_view", { language });
  }, [language]);

  return (
    <div className="min-h-screen bg-[#070a13] text-gray-200">
      <Nav copy={copy} language={language} setLanguage={setLanguage} />
      <main>
        <Hero copy={copy} demoMode={demoMode} />
        <Problem copy={copy} />
        <HowItWorks copy={copy} />
        <DataTrust copy={copy} ruleVersion={ruleVersion} />
        <UseCases copy={copy} />
        <Traction copy={copy} metrics={metrics} />
        <Roadmap copy={copy} />
        <Objections copy={copy} />
        <PilotCta copy={copy} />
      </main>
      <Footer copy={copy} ruleVersion={ruleVersion} />
    </div>
  );
}

function Nav({
  copy,
  language,
  setLanguage,
}: {
  copy: (typeof LANDING_COPY)["en"];
  language: Language;
  setLanguage: (l: Language) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070a13]/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-500/25">
            <ShieldAlert className="h-5 w-5 text-white" />
          </span>
          <span className="leading-none">
            <span className="block text-sm font-bold uppercase tracking-wider text-white">LegalMine</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400">
              Sentinel
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-xs font-medium text-gray-400 md:flex">
          <a className="transition hover:text-white" href="#how">{copy.nav.product}</a>
          <a className="transition hover:text-white" href="#sources">{copy.nav.sources}</a>
          <a className="transition hover:text-white" href="#use-cases">{copy.nav.useCases}</a>
          <Link className="transition hover:text-white" href="/pricing">{copy.nav.pricing}</Link>
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/10 text-[10px] font-bold">
            {(["en", "es"] as Language[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                aria-pressed={language === code}
                className={`px-2 py-1 uppercase transition ${
                  language === code ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          <Link
            href="/app"
            onClick={() => track("launch_app_clicked", { from: "nav" })}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {copy.nav.launch}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ copy, demoMode }: { copy: (typeof LANDING_COPY)["en"]; demoMode: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(59,130,246,0.18) 0%, rgba(7,10,19,0) 70%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-5 py-20 text-center md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
          <Sparkles className="h-3.5 w-3.5" />
          {copy.hero.eyebrow}
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">
          {copy.hero.title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-400 md:text-lg">
          {copy.hero.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            onClick={() => track("launch_app_clicked", { from: "hero" })}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-500"
          >
            {copy.hero.primaryCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how"
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/5"
          >
            {copy.hero.secondaryCta}
          </a>
        </div>
        <p className="mt-5 text-xs text-gray-500">{copy.hero.disclaimer}</p>
        {demoMode ? (
          <p className="mx-auto mt-4 max-w-lg rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2 text-[11px] text-fuchsia-200">
            This deployment has demo mode enabled. Fixture records are available inside the app and
            are always watermarked as DEMO.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Problem({ copy }: { copy: (typeof LANDING_COPY)["en"] }) {
  return (
    <section className="border-b border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="max-w-3xl text-2xl font-bold leading-snug tracking-tight text-white md:text-3xl">
          {copy.problem.title}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-400">{copy.problem.body}</p>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {copy.problem.bullets.map((bullet) => (
            <li
              key={bullet}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-300"
            >
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks({ copy }: { copy: (typeof LANDING_COPY)["en"] }) {
  const icons = [Layers, Database, ShieldAlert, FileText];
  return (
    <section id="how" className="border-b border-white/10">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{copy.how.title}</h2>
        <p className="mt-2 text-sm text-gray-400">{copy.how.subtitle}</p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {copy.how.steps.map((step, index) => {
            const Icon = icons[index] ?? Layers;
            return (
              <div key={step.title} className="glass-panel p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <h3 className="mt-4 text-sm font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">{step.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DataTrust({ copy, ruleVersion }: { copy: (typeof LANDING_COPY)["en"]; ruleVersion: string }) {
  const [sources, setSources] = useState<SourceHealth[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/health/sources")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { sources: SourceHealth[] }) => {
        if (active) setSources(data.sources);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="sources" className="border-b border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{copy.trust.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{copy.trust.subtitle}</p>

        <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
          {sources === null && !failed ? (
            <p className="px-4 py-6 text-center text-xs text-gray-500">Verificando conectores...</p>
          ) : failed ? (
            <p className="px-4 py-6 text-center text-xs text-gray-500">
              No se pudo leer el estado de conectores desde este navegador. Abre{" "}
              <code className="text-gray-400">/api/health/sources</code> para ver la respuesta en vivo.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Fuente</th>
                  <th className="px-4 py-2.5 font-semibold">Estado</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sources?.map((source) => (
                  <tr key={source.sourceKey} className="align-top">
                    <td className="px-4 py-3">
                      <a
                        href={source.docsUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-semibold text-gray-200 underline-offset-2 hover:underline"
                      >
                        {source.sourceName}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={source.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-gray-500 md:table-cell">{source.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-5 rounded-lg border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-xs leading-relaxed text-blue-200">
          {copy.trust.note} Version de reglas vigente: <strong className="font-semibold">{ruleVersion}</strong>.
        </p>
      </div>
    </section>
  );
}

function UseCases({ copy }: { copy: (typeof LANDING_COPY)["en"] }) {
  return (
    <section id="use-cases" className="border-b border-white/10">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{copy.useCases.title}</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {copy.useCases.items.map((item) => (
            <div key={item.title} className="glass-panel p-5">
              <h3 className="text-sm font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Traction({
  copy,
  metrics,
}: {
  copy: (typeof LANDING_COPY)["en"];
  metrics: TractionMetrics;
}) {
  const tiles: { key: string; value: string | null }[] = [
    { key: "assessments", value: metrics.assessments > 0 ? String(metrics.assessments) : null },
    { key: "reportsGenerated", value: metrics.reportsGenerated > 0 ? String(metrics.reportsGenerated) : null },
    { key: "pilotFeedback", value: metrics.pilotFeedback > 0 ? String(metrics.pilotFeedback) : null },
    {
      key: "averageConfidence",
      value: metrics.averageConfidence !== null ? `${metrics.averageConfidence}/100` : null,
    },
    {
      key: "medianTimeSavedMinutes",
      value: metrics.medianTimeSavedMinutes !== null ? String(metrics.medianTimeSavedMinutes) : null,
    },
    {
      key: "wouldUseAgain",
      value:
        metrics.wouldUseAgain.total > 0
          ? `${metrics.wouldUseAgain.yes}/${metrics.wouldUseAgain.total}`
          : null,
    },
  ];
  const populated = tiles.filter((t) => t.value !== null);

  return (
    <section className="border-b border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{copy.traction.title}</h2>
        <p className="mt-2 text-sm text-gray-400">{copy.traction.subtitle}</p>

        {populated.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-white/15 px-5 py-8 text-center text-xs leading-relaxed text-gray-500">
            {copy.traction.empty}
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {populated.map((tile) => (
              <div key={tile.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-3xl font-extrabold tracking-tight text-white">{tile.value}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {copy.traction.labels[tile.key]}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Roadmap({ copy }: { copy: (typeof LANDING_COPY)["en"] }) {
  return (
    <section className="border-b border-white/10">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <div className="flex items-start gap-3">
          <Globe2 className="mt-1 h-5 w-5 shrink-0 text-blue-400" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {copy.roadmap.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">{copy.roadmap.subtitle}</p>
          </div>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {copy.roadmap.phases.map((phase) => (
            <li key={phase.phase} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{phase.phase}</p>
              <p className="mt-1 text-sm font-bold text-white">{phase.market}</p>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">{phase.goal}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Objections({ copy }: { copy: (typeof LANDING_COPY)["en"] }) {
  return (
    <section className="border-b border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{copy.objections.title}</h2>
        <dl className="mt-8 space-y-4">
          {copy.objections.items.map((item) => (
            <div key={item.q} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <dt className="text-sm font-bold text-white">{item.q}</dt>
              <dd className="mt-2 text-xs leading-relaxed text-gray-400">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function PilotCta({ copy }: { copy: (typeof LANDING_COPY)["en"] }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          company: form.get("company"),
          role: form.get("role"),
          source: "landing_pilot_cta",
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(body?.error ?? copy.cta.error);
        setState("error");
        return;
      }
      track("request_pilot_clicked", { from: "landing" });
      setState("sent");
    } catch {
      setMessage(copy.cta.error);
      setState("error");
    }
  }

  return (
    <section id="pilot" className="border-b border-white/10">
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{copy.cta.title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-400">{copy.cta.body}</p>

        {state === "sent" ? (
          <p className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            {copy.cta.success}
          </p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 grid max-w-xl gap-3 text-left">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-400">
                {copy.cta.companyLabel}
                <input
                  name="company"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="text-xs font-semibold text-gray-400">
                {copy.cta.roleLabel}
                <input
                  name="role"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-blue-500"
                />
              </label>
            </div>
            <label className="text-xs font-semibold text-gray-400">
              {copy.cta.emailLabel}
              <input
                name="email"
                type="email"
                required
                placeholder={copy.cta.emailPlaceholder}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-blue-500"
              />
            </label>
            <button
              type="submit"
              disabled={state === "sending"}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : copy.cta.submit}
              <ArrowRight className="h-4 w-4" />
            </button>
            {state === "error" ? <p className="text-xs text-red-300">{message}</p> : null}
          </form>
        )}
      </div>
    </section>
  );
}

function Footer({ copy, ruleVersion }: { copy: (typeof LANDING_COPY)["en"]; ruleVersion: string }) {
  return (
    <footer className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
        <span className="font-semibold text-gray-400">
          {copy.footer.rights} · rule set {ruleVersion}
        </span>
        <div className="flex gap-4">
          <Link href="/app" className="transition hover:text-gray-300">
            {copy.nav.launch}
          </Link>
          <Link href="/pricing" className="transition hover:text-gray-300">
            {copy.nav.pricing}
          </Link>
          <a href="/api/health/sources" className="transition hover:text-gray-300">
            Connector status
          </a>
        </div>
      </div>
      <p className="mt-4 max-w-4xl text-[11px] leading-relaxed text-gray-600">{copy.footer.disclaimer}</p>
    </footer>
  );
}
