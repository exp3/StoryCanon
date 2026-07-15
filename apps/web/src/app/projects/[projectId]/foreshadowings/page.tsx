import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createForeshadowingSchema } from "@/server/validation";
import { CopyButton } from "@/components/copy-button";
import { EditableContent } from "@/components/editable-content";

const statuses = ["UNPLANTED", "PLANTED", "IN_PROGRESS", "RESOLVED", "DROPPED"];
const importances = ["LOW", "MEDIUM", "HIGH"];

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

  async function createForeshadowing(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({
      where: { id: projectId, userId: currentUser.id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) notFound();

    const input = createForeshadowingSchema.parse({
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      plannedResolution: String(formData.get("plannedResolution") ?? "").trim() || undefined,
      status: String(formData.get("status") ?? "") || undefined,
      importance: String(formData.get("importance") ?? "") || undefined,
    });
    await prisma.foreshadowing.create({ data: { ...input, projectId } });
    redirect(`/projects/${projectId}/foreshadowings`);
  }

  async function updateForeshadowing(id: string, formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.foreshadowing.findFirst({
      where: { id, projectId, deletedAt: null, project: { userId: currentUser.id, deletedAt: null } },
      select: { id: true },
    });
    if (!owned) notFound();

    const input = createForeshadowingSchema.partial().parse({
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      plannedResolution: String(formData.get("plannedResolution") ?? "").trim(),
      status: String(formData.get("status") ?? ""),
      importance: String(formData.get("importance") ?? ""),
    });
    await prisma.foreshadowing.update({ where: { id: owned.id }, data: input });
    redirect(`/projects/${projectId}/foreshadowings`);
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
        <form className="mt-4 space-y-4" action={createForeshadowing}>
          <label className="block">
            <span className="text-sm font-medium">{t.titleLabel}</span>
            <input className="mt-1 w-full rounded border px-3 py-2" name="title" required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.descriptionLabel}</span>
            <textarea className="mt-1 min-h-24 w-full rounded border px-3 py-2" name="description" required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.plannedResolutionLabel}</span>
            <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="plannedResolution" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.statusLabel}</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="status" defaultValue="UNPLANTED">
              {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.importanceLabel}</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="importance" defaultValue="MEDIUM">
              {importances.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">{t.create}</button>
        </form>
      </details>
      {foreshadowings.length === 0 ? (
        <p className="text-sm text-[#555]">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {foreshadowings.map((item) => (
            <li key={item.id} className="rounded border bg-white p-4">
              <EditableContent
                action={updateForeshadowing.bind(null, item.id)}
                labels={{ edit: copy.edit, save: copy.saveChanges, cancel: copy.cancel }}
                fields={[
                  { name: "title", label: t.titleLabel, value: item.title, required: true },
                  { name: "description", label: t.descriptionLabel, value: item.description, kind: "textarea", required: true },
                  { name: "plannedResolution", label: t.plannedResolutionLabel, value: item.plannedResolution ?? "", kind: "textarea" },
                  { name: "status", label: t.statusLabel, value: item.status, kind: "select", options: statuses },
                  { name: "importance", label: t.importanceLabel, value: item.importance, kind: "select", options: importances },
                ]}
              >
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
              </EditableContent>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
