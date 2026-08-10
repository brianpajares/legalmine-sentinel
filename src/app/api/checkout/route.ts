import { checkoutEnabled, PLANS, stripePriceId } from "@/lib/billing/plans";
import { badRequest, ok, readJson, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe Checkout session.
 *
 * Called against the REST API directly so the deployment carries no payment SDK.
 * When STRIPE_SECRET_KEY or the plan's price ID is missing, this endpoint says so
 * and the UI falls back to lead capture instead of showing a broken button.
 */
export async function POST(request: Request) {
  const body = await readJson<{ planId?: string; email?: string }>(request);
  const planId = body?.planId?.trim();
  if (!planId) return badRequest("planId is required.");

  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return badRequest(`Unknown plan "${planId}".`);

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = stripePriceId(plan);
  if (!checkoutEnabled() || !priceId || !secret) {
    return badRequest(
      "Checkout is not configured for this plan.",
      `Set STRIPE_SECRET_KEY and ${plan.stripePriceEnv ?? "the plan price ID"} to enable self-serve payment. Until then this plan is sold through a conversation.`,
      "CHECKOUT_UNAVAILABLE",
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? new URL(request.url).origin;

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/app?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
    "metadata[plan_id]": plan.id,
    allow_promotion_codes: "true",
  });
  if (body?.email) params.set("customer_email", body.email);

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const payload = (await response.json()) as { url?: string; error?: { message?: string } };
    if (!response.ok || !payload.url) {
      return badRequest(
        "Stripe could not create a checkout session.",
        payload.error?.message ?? `HTTP ${response.status}`,
        "STRIPE_ERROR",
      );
    }
    return ok({ url: payload.url });
  } catch (error) {
    return serverError(error);
  }
}
