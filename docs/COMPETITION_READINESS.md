# Competition readiness — status against the master plan

Checklist from §27 of *LegalMine Sentinel — Plan Maestro Venture Ready 2026*, with the
actual state of the codebase. Items marked **operator action** are not code problems: they
need a decision, a credential or a conversation with a real user.

## Credibility (P0)

| Check | Status | Where |
|---|---|---|
| No `Math.random()` in business or risk variables | Done, enforced by test | `tests/no-fabrication.test.ts` |
| No fabricated right / holder / RUC without a DEMO badge | Done, enforced by test | fixtures confined to `src/lib/demo/fixtures.ts` |
| No simulated Sentinel-2 presented as real | Done — the synthetic SVG "before/after" comparator was deleted outright | `src/lib/sources/copernicus.ts` |
| REINFO never derived from a risk score | Done — always `MANUAL_VERIFICATION_REQUIRED` unless a real endpoint answers, including in demo mode | `src/lib/sources/reinfo.ts`, `LEG-REINFO-01` |
| Overall risk and data confidence are separate | Done | `src/lib/scoring/engine.ts` |
| Every factor carries source + `fetched_at` + evidence | Done, enforced by test | evidence drawer, dossier appendix |
| Dossier generated from the persisted assessment | Done — zero hard-coded values in the report component | `src/components/report/Dossier.tsx` |
| A "missing / not verified" section exists | Done | `MissingData.tsx`, dossier §9 |
| INGEMMET works in the verified case | **Operator action** — adapter and query are implemented; the exact layer URL must be locked per deployment | `npm run sources:probe` → `INGEMMET_LAYER_URL` |
| SERNANP works in the verified case | **Operator action** — same | `SERNANP_LAYER_URL` |

The two operator actions are the critical path. The connectors are written against the
standard ArcGIS REST `query` contract and fail honestly until pointed at a verified layer;
locking the URLs is a ten-minute task once the services are reachable from the deployment.

## Product and narrative

| Check | Status |
|---|---|
| Landing explains the problem and the buyer in under 20 seconds | Done — problem, workflow, live connector status, use cases, roadmap, objections |
| Core flow available in English | Done — English is the default throughout; the landing has an EN/ES toggle |
| Screening / no-legal-advice disclaimer visible | Done — on the landing, in the workspace and on the dossier cover |
| Peru as beachhead, U.S. as roadmap (not claimed coverage) | Done — the roadmap section states Phase 2 explicitly as a proof of concept |
| Opportunity Radar reformulated as screening, not viability | Done — derived from stored assessments, never from per-asset hand-set values |
| Build, lint and tests pass | Done — 36 tests |

## Traction and monetization

| Check | Status |
|---|---|
| Analytics records the activation funnel | Done — PostHog when configured, nothing invented when not |
| Pilot feedback is stored | Done — `/api/feedback`, feeds the landing metrics |
| Traction figures come only from real records | Done — an empty deployment shows "no usage recorded yet" |
| Pricing published | Done — four plans, framed as introductory rather than validated |
| Payment path live | **Operator action** — set `STRIPE_SECRET_KEY` and the price IDs; until then the funnel captures leads |
| 5 interviews / 3 pilots / written interest | **Operator action** — the product now produces the evidence; the conversations still have to happen |

## Deliberate scope cuts

Per the plan's stop rule ("a credible core beats six half-finished integrations"), three
things were left explicitly unfinished rather than approximated:

1. **No vegetation-change index.** Computing NDVI properly needs band downloads, cloud
   masking and calibration against verified cases. The rule reports inconclusive and the
   gap is listed, which is defensible; a hand-tuned threshold would not be.
2. **Territorial (BDPI) and water (ANA) connectors ship unconfigured.** Their exact layers
   were not confirmed, so the dimensions are reported as not evaluated and their weight is
   redistributed. This is also the clearest live demonstration of the missing-data
   mechanism working.
3. **No authentication.** Until it exists, the deployment should not accept confidential
   third-party polygons.

## Demo script support (§19)

The three-minute demo maps onto real screens: `/` for the problem, `/app` for Create
Assessment, the Source Check tab for connector honesty, Risk Explorer plus the evidence
drawer for explainability, the Evidence Map for the spatial layer, and `/report/<id>` for
the dossier. With `NEXT_PUBLIC_DEMO_MODE=true` the whole path is walkable without any
connector configured — every screen watermarked DEMO.

## Investor confidence test (§18.2)

| Question | Answer in the product |
|---|---|
| Can I click a score and understand it in 30 seconds? | Factor card shows severity, points contributed, the rule ID and a plain-language rationale |
| Can I tell official from referential, user-provided and demo? | Tier badge on every evidence record, plus a watermark on demo surfaces |
| Can I see what the platform does not know? | The "Not Verified" tab and dossier §9, each naming the conclusion it blocks |
| Can I repeat the analysis tomorrow and understand what changed? | Assessments are immutable and stamped with a geometry hash and rule version |
| Do I understand who pays and how it scales? | `/pricing` and the jurisdiction roadmap |
| Is there evidence someone real used it? | Traction counters, populated only by real assessments and real feedback |
