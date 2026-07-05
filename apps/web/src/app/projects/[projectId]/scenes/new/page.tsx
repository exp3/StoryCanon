import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createSceneSchema } from "@/server/validation";

export default async function NewScenePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).sceneNew;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const chapters = await prisma.chapter.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, title: true },
  });

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

          const chapterId = String(formData.get("chapterId") ?? "") || undefined;
          const parsed = createSceneSchema.parse({
            title: String(formData.get("title") ?? ""),
            body: String(formData.get("body") ?? ""),
            summary: String(formData.get("summary") ?? "") || undefined,
            chapterId,
          });

          const order = await prisma.scene.count({ where: { projectId, deletedAt: null } });
          const scene = await prisma.scene.create({
            data: { ...parsed, order, projectId },
            select: { id: true },
          });

          redirect(`/projects/${projectId}/scenes/${scene.id}`);
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">{t.labelTitle}</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="title" required />
        </label>
        {chapters.length > 0 ? (
          <label className="block">
            <span className="text-sm font-medium">{t.labelChapter}</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="chapterId" defaultValue="">
              <option value="">{t.chapterNone}</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium">{t.labelSummary}</span>
          <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="summary" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelBody}</span>
          <textarea className="mt-1 min-h-64 w-full rounded border px-3 py-2 font-mono text-sm" name="body" required />
        </label>
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">
          {t.save}
        </button>
      </form>
    </main>
  );
}
