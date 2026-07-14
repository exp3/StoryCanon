import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createRevisionTodoSchema } from "@/server/validation";
import { CopyButton } from "@/components/copy-button";
import { EditableContent } from "@/components/editable-content";

const statuses = ["OPEN", "IN_PROGRESS", "DONE", "ON_HOLD", "DROPPED"];
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default async function RevisionTodosPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).revisionTodos;
  const copy = getDictionary(user.locale).common;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const revisionTodos = await prisma.revisionTodo.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  async function updateRevisionTodo(id: string, formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.revisionTodo.findFirst({
      where: { id, projectId, deletedAt: null, project: { userId: currentUser.id, deletedAt: null } },
      select: { id: true },
    });
    if (!owned) notFound();

    const input = createRevisionTodoSchema.partial().parse({
      title: String(formData.get("title") ?? "").trim(),
      problem: String(formData.get("problem") ?? "").trim(),
      suggestion: String(formData.get("suggestion") ?? "").trim(),
      status: String(formData.get("status") ?? ""),
      priority: String(formData.get("priority") ?? ""),
    });
    await prisma.revisionTodo.update({ where: { id: owned.id }, data: input });
    redirect(`/projects/${projectId}/revision-todos`);
  }

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
              <EditableContent
                action={updateRevisionTodo.bind(null, item.id)}
                labels={{ edit: copy.edit, save: copy.saveChanges, cancel: copy.cancel }}
                fields={[
                  { name: "title", label: t.titleLabel, value: item.title, required: true },
                  { name: "problem", label: t.problemLabel, value: item.problem, kind: "textarea", required: true },
                  { name: "suggestion", label: t.suggestionFormLabel, value: item.suggestion ?? "", kind: "textarea" },
                  { name: "status", label: t.statusLabel, value: item.status, kind: "select", options: statuses },
                  { name: "priority", label: t.priorityFormLabel, value: item.priority, kind: "select", options: priorities },
                ]}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{item.title}</p>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-[#666]">
                      {item.status} ・{t.priorityLabel} {item.priority}
                    </span>
                    <CopyButton
                      labels={copy}
                      value={[item.title, item.problem, item.suggestion ? `${t.suggestionLabel} ${item.suggestion}` : ""]
                        .filter(Boolean)
                        .join("\n")}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#555]">{item.problem}</p>
                {item.suggestion ? (
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    {t.suggestionLabel} {item.suggestion}
                  </p>
                ) : null}
              </EditableContent>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
