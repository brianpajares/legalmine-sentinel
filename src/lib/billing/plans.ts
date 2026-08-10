/**
 * Commercial plans (Plan Maestro §14.1).
 *
 * These are introductory prices, set by us and open to revision as pilots come
 * back — the page says exactly that rather than implying a validated,
 * market-tested price list. Checkout is live only where a Stripe price ID has
 * been configured; every other plan routes to a conversation.
 */

export interface Plan {
  id: string;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  cta: string;
  /** Environment variable holding the Stripe price ID for this plan. */
  stripePriceEnv?: string;
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "pilot",
    name: "Pilot",
    price: "Free",
    cadence: "limited engagement",
    tagline: "Prove it on an asset you are already evaluating.",
    features: [
      "Up to 5 screenings on real areas of interest",
      "Full evidence dossier for each one",
      "A working session to interpret the results with you",
      "In exchange: 15 minutes of structured feedback",
    ],
    cta: "Request a pilot",
  },
  {
    id: "professional",
    name: "Professional",
    price: "$299",
    cadence: "per user / month",
    tagline: "For the consultant or analyst who screens assets continuously.",
    features: [
      "Unlimited screenings on official connectors",
      "Explainable factor breakdown and evidence drawer",
      "Preliminary due-diligence dossier export",
      "Assessment history with reproducible rule versions",
      "Email support",
    ],
    cta: "Start with Professional",
    stripePriceEnv: "STRIPE_PRICE_PROFESSIONAL",
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    price: "$1,200",
    cadence: "per month, up to 10 seats",
    tagline: "For land, legal and sustainability teams working one portfolio.",
    features: [
      "Everything in Professional",
      "Shared project portfolio and opportunity radar",
      "Pilot feedback capture across the team",
      "Priority connector configuration for your jurisdictions",
      "Onboarding session",
    ],
    cta: "Start with Team",
    stripePriceEnv: "STRIPE_PRICE_TEAM",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "From $18,000",
    cadence: "per year",
    tagline: "For multi-jurisdiction operators and investment platforms.",
    features: [
      "Everything in Team",
      "Custom rule sets and thresholds per jurisdiction",
      "API access and scheduled portfolio monitoring",
      "SSO and dedicated tenancy",
      "Named support with an availability commitment",
    ],
    cta: "Talk to us",
  },
];

export const PRICING_NOTE =
  "Introductory pricing set by LegalMine Sentinel and reviewed as pilot feedback comes in. Not a validated or benchmarked price list — if the plan does not fit how your team buys, tell us and we will price the pilot instead.";

export function stripePriceId(plan: Plan): string | undefined {
  if (!plan.stripePriceEnv) return undefined;
  const value = process.env[plan.stripePriceEnv];
  return value && value.trim() ? value.trim() : undefined;
}

export function checkoutEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Plans whose checkout is actually wired up in this deployment. */
export function payablePlanIds(): string[] {
  if (!checkoutEnabled()) return [];
  return PLANS.filter((plan) => stripePriceId(plan)).map((plan) => plan.id);
}
