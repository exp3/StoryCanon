import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createPlotThreadSchema } from "@/server/validation";
import { CopyButton } from "@/components/copy-button";
import { EditableContent } from "@/components/editable-content";

const statuses = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "DROPPED"];

export default async function PlotThreadsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).plotThreads;
  const copy = getDictionary(user.locale).common;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const plotThreads = await prisma.plotThread.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  async function createPlotThread(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({
      where: { id: projectId, userId: currentUser.id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) notFound();

    const input = createPlotThreadSchema.parse({
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || undefined,
      currentState: String(formData.get("currentState") ?? "").trim() || undefined,
      resolutionCondition: String(formData.get("resolutionCondition") ?? "").trim() || undefined,
      status: String(formData.get("status") ?? "") || undefined,
    });
    await prisma.plotThread.create({ data: { ...input, projectId } });
    redirect(`/projects/${projectId}/plot-threads`);
  }

  async function updatePlotThread(id: string, formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.plotThread.findFirst({
      where: { id, projectId, deletedAt: null, project: { userId: currentUser.id, deletedAt: null } },
      select: { id: true },
    });
    if (!owned) notFound();

    const input = createPlotThreadSchema.partial().parse({
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      currentState: String(formData.get("currentState") ?? "").trim(),
      resolutionCondition: String(formData.get("resolutionCondition") ?? "").trim(),
      status: String(formData.get("status") ?? ""),
    });
    await prisma.plotThread.update({ where: { id: owned.id }, data: input });
    redirect(`/projects/${projectId}/plot-threads`);
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
      <details className="mb-6 rounded border bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">{t.addNew}</summary>
        <form className="mt-4 space-y-4" action={createPlotThread}>
          <label className="block">
            <span className="text-sm font-medium">{t.titleLabel}</span>
            <input className="mt-1 w-full rounded border px-3 py-2" name="title" required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.descriptionLabel}</span>
            <textarea className="mt-1 min-h-24 w-full rounded border px-3 py-2" name="description" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.currentStateFormLabel}</span>
            <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="currentState" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.resolutionConditionLabel}</span>
            <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="resolutionCondition" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.statusLabel}</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="status" defaultValue="NOT_STARTED">
              {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">{t.create}</button>
        </form>
      </details>
      {plotThreads.length === 0 ? (
        <p className="text-sm text-[#555]">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {plotThreads.map((item) => (
            <li key={item.id} className="rounded border bg-white p-4">
              <EditableContent
                action={updatePlotThread.bind(null, item.id)}
                labels={{ edit: copy.edit, save: copy.saveChanges, cancel: copy.cancel }}
                fields={[
                  { name: "title", label: t.titleLabel, value: item.title, required: true },
                  { name: "description", label: t.descriptionLabel, value: item.description ?? "", kind: "textarea" },
                  { name: "currentState", label: t.currentStateFormLabel, value: item.currentState ?? "", kind: "textarea" },
                  { name: "resolutionCondition", label: t.resolutionConditionLabel, value: item.resolutionCondition ?? "", kind: "textarea" },
                  { name: "status", label: t.statusLabel, value: item.status, kind: "select", options: statuses },
                ]}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{item.title}</p>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-[#666]">{item.status}</span>
                    <CopyButton
                      labels={copy}
                      value={[item.title, item.description, item.currentState ? `${t.currentStateLabel} ${item.currentState}` : ""]
                        .filter(Boolean)
                        .join("\n")}
                    />
                  </div>
                </div>
                {item.description ? <p className="mt-2 text-sm leading-6 text-[#555]">{item.description}</p> : null}
                {item.currentState ? (
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    {t.currentStateLabel} {item.currentState}
                  </p>
                ) : null}
                {item.resolutionCondition ? (
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    {t.resolutionConditionLabel}: {item.resolutionCondition}
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
