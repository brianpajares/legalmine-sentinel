# LegalMine Sentinel

**Mining due diligence & GeoRisk intelligence.** Screen the legal, environmental and
territorial risk of a mining asset against official registries and geospatial services,
get an explainable score, and export a traceable evidence dossier.

> **Preliminary screening — not legal advice.** The product flags issues worth
> investigating. It does not establish legality, title, viability or compliance, and it
> does not replace review by qualified legal, environmental or land professionals.

---

## The one rule this codebase enforces

**Nothing invented is ever presented as real.**

Concretely, that means:

- No `Math.random()` anywhere in the application source. A test fails the build if it
  reappears (`tests/no-fabrication.test.ts`).
- Scoring runs in one direction only: **evidence → factors → dimensions → overall score**.
  No rule may read the score it contributes to, and registration status is never derived
  from a risk number.
- When a source cannot answer, the adapter returns `UNAVAILABLE`,
  `MANUAL_VERIFICATION_REQUIRED` or `NOT_CONFIGURED`. The affected factor becomes
  *inconclusive*, the gap is listed in "what we could not verify", and **data confidence**
  falls. No substitute value is generated.
- Satellite imagery is never simulated. This version reports scene metadata only and
  derives no conclusion about ground activity from images.
- An area where nothing could be measured reports `NOT_ASSESSED`, not "low risk".

---

## Verified mode vs demo mode

| | Verified mode (default) | Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) |
|---|---|---|
| Data | Live queries against configured official services | Fictional fixtures from `src/lib/demo/fixtures.ts` |
| Engine | Same deterministic rule set | Same deterministic rule set |
| Labelling | Records carry `Official` / `Reference` / `User-provided` badges | Every record carries a `DEMO` badge, a diagonal watermark and a banner |
| Dossier | Standard report | Same report with a "DEMONSTRATION DOSSIER" header |
| REINFO | Manual verification required | **Still** manual verification required — registration status is never simulated |
| Satellite | Real Sentinel-2 catalogue when enabled | Not configured — no fake imagery is generated |

Demo mode only *adds* a clearly labelled fixture path. It never changes how a real source
is reported.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in the layers you have verified
npm run dev                    # http://localhost:3000
```

With no configuration at all the app still runs end to end: it reports every connector as
`NOT_CONFIGURED`, produces a `NOT_ASSESSED` result, and lists every check as pending. That
is the correct behaviour, not a failure state.

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Vitest suite: determinism, source failure, upload validation, evidence traceability, anti-fabrication |
| `npm run lint` | ESLint |
| `npm run sources:probe` | Lists ArcGIS services and layers so you can lock the exact layer URLs |

---

## Configuring the official sources

Government services reorganise their layer indexes without notice, so endpoints are
**deployment settings, not constants**. Discover them once per environment:

```bash
npm run sources:probe
```

It walks the published service roots, prints every layer with its index, and flags likely
candidates with the environment variable to set. Paste the chosen URLs into `.env.local`,
then confirm:

```bash
curl -s localhost:3000/api/health/sources | jq
```

`/api/health/sources` probes each layer **at request time**. Nothing in this product
displays "connected" or "synced" without a live probe behind it.

| Source | Variable | Priority | Notes |
|---|---|---|---|
| INGEMMET — mining cadastre (GEOCATMIN) | `INGEMMET_LAYER_URL` | P0 | ArcGIS REST layer. Cadastral data is referential; confirm against the official file. |
| SERNANP — protected areas (Geo ANP) | `SERNANP_LAYER_URL` | P0 | ArcGIS REST layer. An intersection is a screening signal, not an automatic prohibition. |
| MINEM — REINFO | `REINFO_API_URL` | P1 | Leave unset unless a stable official interface is confirmed. The default adapter requires manual verification and never scrapes silently. |
| Copernicus — Sentinel-2 L2A | `COPERNICUS_ENABLED`, `COPERNICUS_STAC_URL` | P2 | Scene metadata only; no index is computed. |
| MINCUL BDPI — territorial context | `BDPI_LAYER_URL` | P2 | Context, not a legal conclusion. |
| ANA — water resources | `ANA_LAYER_URL` | P2 | Confirm the exact layer before automating. |

Field names can be remapped per deployment (`INGEMMET_FIELD_*`, `SERNANP_FIELD_*`) without
touching code. When an attribute is missing, the UI says "not reported by the source"
rather than showing a placeholder.

---

## Storage

The default store is **in-memory and ephemeral** — projects and assessments are lost on
restart, and `/api/health/sources` says so out loud. For durable, reproducible dossiers:

1. Apply `supabase/migrations/0001_init.sql` to a Postgres/Supabase project.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Assessments are immutable: a database trigger rejects updates, and re-running a screening
creates a new assessment rather than overwriting the old one. A decision made six months
ago stays reproducible.

Row level security is enabled on every table with no policy granted, so the anon and
authenticated roles cannot read anything — the app reaches the data only through the
service role key held server-side.

---

## Architecture

```
src/
  app/
    page.tsx                    Investor-facing landing (EN default, ES toggle)
    app/page.tsx                Screening workspace
    pricing/page.tsx            Plans and lead capture
    report/[id]/page.tsx        Printable evidence dossier
    api/
      projects/                 AOI validation and project creation
      assessments/              Orchestration, frozen evidence, report events
      health/sources/           Live connector probes
      leads/ feedback/ metrics/ Commercial funnel and real traction counts
      checkout/                 Stripe Checkout (env-gated)
  lib/
    geo/          KML & GeoJSON parsing, area, intersection, geometry hashing
    sources/      SourceResult contract, ArcGIS client, one adapter per source
    rules/        Versioned rule set (2026.08-v1) — every threshold lives here
    scoring/      Deterministic engine, dimension aggregation, confidence
    store/        Pluggable persistence (memory | Supabase)
    demo/         The only place fictional records may exist
  types/          Domain model: sources, evidence, assessment, geometry
```

### The scoring model

**Overall screening risk** = Σ (dimension weight × dimension score), each on 0–100.

| Dimension | Weight | Sources |
|---|---|---|
| Legal & tenure | 30% | INGEMMET, REINFO |
| Environmental restrictions | 25% | SERNANP |
| Territorial & social context | 20% | BDPI |
| Water & physical constraints | 10% | ANA |
| Remote-sensing change | 15% | Copernicus |

Dimensions that could not be evaluated are **excluded** and their weight is redistributed
proportionally, so the total stays on 0–100 and every point is attributable to a factor.

**Data confidence** is computed separately — 40% completeness, 30% freshness, 30% source
authority — precisely so that a high risk score on thin data cannot read as certainty.

Every threshold and weight lives in `src/lib/rules/v1.ts` under `RULE_VERSION`. Changing a
number means publishing a new version; stored assessments keep the version they were
scored with.

---

## Monetization

`/pricing` carries four plans (Pilot, Professional, Team, Enterprise). Self-serve checkout
goes live for a plan once `STRIPE_SECRET_KEY` and that plan's price ID are set; until then
the button records a lead and routes to a conversation, and the card says so rather than
failing silently. A lead is always stored **before** checkout is attempted, so an abandoned
or failed payment still reaches a human.

Prices are presented as introductory and open to revision — never as validated or
benchmarked.

---

## Instrumentation

Funnel events (`assessment_started`, `source_check_completed`, `assessment_completed`,
`factor_opened`, `report_generated`, `pilot_feedback_submitted`, `request_pilot_clicked`)
go to PostHog when `NEXT_PUBLIC_POSTHOG_KEY` is set, and nowhere otherwise — there is no
local fallback that pretends to record analytics.

The traction figures on the landing page do **not** come from that stream. They are counts
of records that exist in storage: assessments run, dossiers generated, pilot responses
received, median time saved from measured baselines. An empty deployment shows "no usage
recorded yet" rather than a placeholder number.

---

## Known limitations

- **No authentication yet.** Do not accept confidential third-party polygons on a public
  deployment until access control is added.
- **No vegetation-change index.** Satellite evidence is scene metadata only; the factor is
  reported inconclusive by design rather than estimated.
- **Union coverage is approximated.** Overlapping mining rights are summed and capped at
  100% of the AOI rather than clipped pairwise. Cadastral parcels are largely
  non-overlapping, so the error is bounded, but the figure is a screening estimate.
- **REINFO has no automated lookup** in the default configuration, and absence of a record
  is never treated as evidence of illegality.
- **Territorial and water dimensions ship unconfigured**, which is why a default
  installation reports four open due-diligence gaps.

---

## Testing

```bash
npm test
```

The suite covers the acceptance tests from the product plan: determinism across repeated
runs, correct degradation when a source fails, upload validation (including rejecting
projected coordinates), evidence traceability for every scored factor, screening-language
constraints, and a static sweep for fabricated business data.
