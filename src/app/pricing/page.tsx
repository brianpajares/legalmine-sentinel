import type { Metadata } from "next";

import Pricing from "@/components/pricing/Pricing";
import { payablePlanIds } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing — LegalMine Sentinel",
  description:
    "Plans for mining due-diligence screening: pilot, professional, team and enterprise. Introductory pricing, reviewed as pilot feedback comes in.",
};

export default function PricingPage() {
  return <Pricing payablePlanIds={payablePlanIds()} />;
}
