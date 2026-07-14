import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary, localeTag } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { CopyButton } from "@/components/copy-button";

export default async function StoryStatePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).storyState;
  const copy = getDictionary(user.locale).common;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const snapshots = await prisma.storyStateSnapshot.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "desc" },
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
      {snapshots.length === 0 ? (
        <p className="text-sm text-[#555]">{t.empty}</p>
      ) : (
        <ul className="space-y-4">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="rounded border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[#666]">{snapshot.createdAt.toLocaleString(localeTag(user.locale))}</p>
                <CopyButton
                  labels={copy}
                  value={[
                    snapshot.summary,
                    snapshot.recentEvents ? `${t.recentEventsLabel} ${snapshot.recentEvents}` : "",
                    snapshot.unresolvedProblems ? `${t.unresolvedLabel} ${snapshot.unresolvedProblems}` : "",
                    snapshot.nextOptions ? `${t.nextOptionsLabel} ${snapshot.nextOptions}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n")}
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-[#555]">{snapshot.summary}</p>
              {snapshot.recentEvents ? (
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  {t.recentEventsLabel} {snapshot.recentEvents}
                </p>
              ) : null}
              {snapshot.unresolvedProblems ? (
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  {t.unresolvedLabel} {snapshot.unresolvedProblems}
                </p>
              ) : null}
              {snapshot.nextOptions ? (
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  {t.nextOptionsLabel} {snapshot.nextOptions}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
