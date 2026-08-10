import { randomUUID } from "node:crypto";

import type { Lead } from "@/types/assessment";
import { getStore } from "@/lib/store";
import { badRequest, created, ok, readJson, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface LeadBody {
  email?: string;
  name?: string;
  company?: string;
  role?: string;
  plan?: string;
  message?: string;
  source?: string;
}

/** Pilot requests and plan enquiries. This is the commercial funnel's entry point. */
export async function POST(request: Request) {
  const body = await readJson<LeadBody>(request);
  const email = body?.email?.trim().toLowerCase();
  if (!email || !EMAIL.test(email)) {
    return badRequest("A valid work email address is required.", undefined, "EMAIL_INVALID");
  }

  try {
    const store = await getStore();
    const lead: Lead = {
      id: `lead_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      email,
      name: body?.name?.trim() || undefined,
      company: body?.company?.trim() || undefined,
      role: body?.role?.trim() || undefined,
      plan: body?.plan?.trim() || undefined,
      message: body?.message?.trim() || undefined,
      source: body?.source?.trim() || "website",
      createdAt: new Date().toISOString(),
    };
    await store.saveLead(lead);
    return created({
      lead: { id: lead.id, email: lead.email, plan: lead.plan },
      storage: { kind: store.kind, ephemeral: store.ephemeral },
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function GET() {
  try {
    const store = await getStore();
    const leads = await store.listLeads();
    // Only counts are exposed; addresses stay server-side.
    return ok({ count: leads.length, latest: leads[0]?.createdAt ?? null });
  } catch (error) {
    return serverError(error);
  }
}
