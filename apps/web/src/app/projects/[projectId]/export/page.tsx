import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { getPlan } from "@/server/plan";
import { requireSessionUser } from "@/server/session";

export default async function ExportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).exportPage;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const plan = await getPlan(user.id);
  const canExportJson = plan !== "FREE";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          {t.backToProject}
        </Link>
      </div>
      <div className="space-y-3 rounded border bg-white p-6">
        <div className="flex items-center justify-between rounded border border-[#ece8dd] px-4 py-3">
          <div>
            <p className="font-medium">{t.markdownTitle}</p>
            <p className="mt-1 text-sm text-[#555]">{t.markdownDesc}</p>
          </div>
          <a className="rounded bg-black px-4 py-2 text-sm text-white" href={`/api/projects/${projectId}/export/markdown`}>
            {t.download}
          </a>
        </div>
        <div className="flex items-center justify-between rounded border border-[#ece8dd] px-4 py-3">
          <div>
            <p className="font-medium">{t.jsonTitle}</p>
            <p className="mt-1 text-sm text-[#555]">
              {t.jsonDesc}
              {canExportJson ? "" : ` ${t.planRestriction}`}
            </p>
          </div>
          {canExportJson ? (
            <a className="rounded bg-black px-4 py-2 text-sm text-white" href={`/api/projects/${projectId}/export/json`}>
              {t.download}
            </a>
          ) : (
            <span className="rounded bg-[#dedbd2] px-4 py-2 text-sm text-[#666]">{t.unavailable}</span>
          )}
        </div>
      </div>
    </main>
  );
}
