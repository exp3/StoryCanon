import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createWorldNoteSchema } from "@/server/validation";

const categories = ["PLACE", "ORGANIZATION", "TECHNOLOGY", "HISTORY", "CULTURE", "ITEM", "RULE", "OTHER"] as const;
const importances = ["LOW", "MEDIUM", "HIGH"] as const;

export default async function NewWorldNotePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).worldNoteNew;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold">{t.title}</h1>
      <form
        className="space-y-4 rounded border bg-white p-6"
        action={async (formData) => {
          "use server";

          const currentUser = await requireSessionUser();
          const owned = await prisma.project.findFirst({ where: { id: projectId, userId: currentUser.id, deletedAt: null } });
          if (!owned) notFound();

          const parsed = createWorldNoteSchema.parse({
            title: String(formData.get("title") ?? ""),
            body: String(formData.get("body") ?? ""),
            category: String(formData.get("category") ?? "OTHER"),
            importance: String(formData.get("importance") ?? "MEDIUM"),
          });

          const worldNote = await prisma.worldNote.create({ data: { ...parsed, projectId }, select: { id: true } });
          redirect(`/projects/${projectId}/world-notes/${worldNote.id}`);
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">{t.labelTitle}</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="title" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelCategory}</span>
          <select className="mt-1 w-full rounded border px-3 py-2" name="category" defaultValue="OTHER">
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelImportance}</span>
          <select className="mt-1 w-full rounded border px-3 py-2" name="importance" defaultValue="MEDIUM">
            {importances.map((importance) => (
              <option key={importance} value={importance}>
                {importance}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelBody}</span>
          <textarea className="mt-1 min-h-48 w-full rounded border px-3 py-2" name="body" required />
        </label>
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">
          {t.save}
        </button>
      </form>
    </main>
  );
}
