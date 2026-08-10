import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ClientReportFallback from "@/components/report/ClientReportFallback";
import Dossier from "@/components/report/Dossier";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Dossier ${id} - LegalMine Sentinel`,
    description: "Informe preliminar de tamizaje legal y territorial minero. No constituye asesoria legal.",
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let assessment = null;
  let project = null;
  try {
    const store = await getStore();
    assessment = await store.getAssessment(id);
    if (assessment) project = await store.getProject(assessment.projectId);
  } catch {
    assessment = null;
  }

  if (!assessment) {
    return <ClientReportFallback assessmentId={id} />;
  }

  if (!assessment.id) notFound();

  return <Dossier assessment={assessment} project={project} />;
}
