import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";

export default async function RevisionTodosPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).revisionTodos;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const revisionTodos = await prisma.revisionTodo.findMany({
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
      {revisionTodos.length === 0 ? (
        <p className="text-sm text-[#555]">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {revisionTodos.map((item) => (
            <li key={item.id} className="rounded border bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium">{item.title}</p>
                <span className="shrink-0 text-xs text-[#666]">
                  {item.status} ・{t.priorityLabel} {item.priority}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#555]">{item.problem}</p>
              {item.suggestion ? (
                <p className="mt-2 text-sm leading-6 text-[#555]">
                  {t.suggestionLabel} {item.suggestion}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
