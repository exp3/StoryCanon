import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { CopyButton } from "@/components/copy-button";

export default async function ForeshadowingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).foreshadowings;
  const copy = getDictionary(user.locale).common;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const foreshadowings = await prisma.foreshadowing.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          {t.backToProject}
        </Link>
      </div>
      <p className="mb-4 text-sm leading-6 text-[#4b4b45]">{t.description}</p>
      {foreshadowings.length === 0 ? (
        <p className="text-sm text-[#555]">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {foreshadowings.map((item) => (
            <li key={item.id} className="rounded border bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium">{item.title}</p>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-[#666]">
                    {item.status} ・{t.importanceLabel} {item.importance}
                  </span>
                  <CopyButton
                    labels={copy}
                    value={[item.title, item.description, item.plannedResolution ? `${t.resolutionLabel} ${item.plannedResolution}` : ""]
                      .filter(Boolean)
                      .join("\n")}
                  />
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#555]">{item.description}</p>
              {item.plannedResolution ? (
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  {t.resolutionLabel} {item.plannedResolution}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
