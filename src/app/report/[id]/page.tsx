import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    title: `Screening dossier ${id} — LegalMine Sentinel`,
    description: "Preliminary mining due-diligence screening dossier. Not legal advice.",
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
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 text-center">
        <h1 className="text-lg font-bold text-white">This assessment is not available</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          No stored assessment matches <span className="font-mono text-xs">{id}</span>. If this
          deployment uses the ephemeral in-memory store, the assessment was lost when the server
          restarted — configure durable storage to keep dossiers reproducible.
        </p>
        <Link
          href="/app"
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          Run a new screening
        </Link>
      </main>
    );
  }

  if (!assessment.id) notFound();

  return <Dossier assessment={assessment} project={project} />;
}
