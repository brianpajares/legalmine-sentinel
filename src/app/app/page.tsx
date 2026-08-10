import type { Metadata } from "next";

import Workspace from "@/components/workspace/Workspace";
import { isDemoMode } from "@/lib/sources/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Run a screening — LegalMine Sentinel",
  description:
    "Define an area of interest, check official sources, run an explainable screening and export the evidence dossier.",
};

export default function AppPage() {
  return <Workspace demoMode={isDemoMode()} />;
}
