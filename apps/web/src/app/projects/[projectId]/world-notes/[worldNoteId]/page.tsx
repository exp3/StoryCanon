import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createWorldNoteSchema } from "@/server/validation";

const categories = ["PLACE", "ORGANIZATION", "TECHNOLOGY", "HISTORY", "CULTURE", "ITEM", "RULE", "OTHER"] as const;
const importances = ["LOW", "MEDIUM", "HIGH"] as const;

export default async function WorldNoteDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; worldNoteId: string }>;
}) {
  const user = await requireSessionUser();
  const { projectId, worldNoteId } = await params;
  const t = getDictionary(user.locale).worldNoteDetail;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const worldNote = await prisma.worldNote.findFirst({ where: { id: worldNoteId, projectId, deletedAt: null } });
  if (!worldNote) notFound();

  async function updateWorldNote(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({ where: { id: projectId, userId: currentUser.id, deletedAt: null } });
    if (!owned) notFound();

    const parsed = createWorldNoteSchema.partial().parse({
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      category: String(formData.get("category") ?? "OTHER"),
      importance: String(formData.get("importance") ?? "MEDIUM"),
    });

    await prisma.worldNote.update({ where: { id: worldNoteId }, data: parsed });
    redirect(`/projects/${projectId}/world-notes/${worldNoteId}`);
  }

  async function deleteWorldNote() {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({ where: { id: projectId, userId: currentUser.id, deletedAt: null } });
    if (!owned) notFound();

    await prisma.worldNote.update({ where: { id: worldNoteId }, data: { deletedAt: new Date() } });
    redirect(`/projects/${projectId}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          {t.backToProject}
        </Link>
      </div>

      <form className="space-y-4 rounded border bg-white p-6" action={updateWorldNote}>
        <label className="block">
          <span className="text-sm font-medium">{t.labelTitle}</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="title" defaultValue={worldNote.title} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelCategory}</span>
          <select className="mt-1 w-full rounded border px-3 py-2" name="category" defaultValue={worldNote.category}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelImportance}</span>
          <select className="mt-1 w-full rounded border px-3 py-2" name="importance" defaultValue={worldNote.importance}>
            {importances.map((importance) => (
              <option key={importance} value={importance}>
                {importance}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelBody}</span>
          <textarea className="mt-1 min-h-48 w-full rounded border px-3 py-2" name="body" defaultValue={worldNote.body} required />
        </label>
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">
          {t.save}
        </button>
      </form>

      <form className="mt-4" action={deleteWorldNote}>
        <button className="rounded border border-red-600 px-4 py-2 text-sm text-red-600" type="submit">
          {t.delete}
        </button>
      </form>
    </main>
  );
}
