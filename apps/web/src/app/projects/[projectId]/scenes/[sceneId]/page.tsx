import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createSceneSchema } from "@/server/validation";
import { IndentTextarea } from "@/components/indent-textarea";
import { FieldCopyButton } from "@/components/copy-button";

export default async function SceneDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sceneId: string }>;
}) {
  const user = await requireSessionUser();
  const { projectId, sceneId } = await params;
  const t = getDictionary(user.locale).sceneDetail;
  const copy = getDictionary(user.locale).common;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId, deletedAt: null } });
  if (!scene) notFound();

  const chapters = await prisma.chapter.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, title: true },
  });

  async function updateScene(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({ where: { id: projectId, userId: currentUser.id, deletedAt: null } });
    if (!owned) notFound();

    const chapterId = String(formData.get("chapterId") ?? "") || undefined;
    const parsed = createSceneSchema.partial().parse({
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      summary: String(formData.get("summary") ?? "") || undefined,
      chapterId,
    });

    await prisma.scene.update({ where: { id: sceneId }, data: parsed });
    redirect(`/projects/${projectId}/scenes/${sceneId}`);
  }

  async function deleteScene() {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({ where: { id: projectId, userId: currentUser.id, deletedAt: null } });
    if (!owned) notFound();

    await prisma.scene.update({ where: { id: sceneId }, data: { deletedAt: new Date() } });
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

      <form className="space-y-4 rounded border bg-white p-6" action={updateScene}>
        <div className="block">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="scene-title">{t.labelTitle}</label>
            <FieldCopyButton targetId="scene-title" labels={copy} />
          </div>
          <input id="scene-title" className="mt-1 w-full rounded border px-3 py-2" name="title" defaultValue={scene.title} required />
        </div>
        {chapters.length > 0 ? (
          <label className="block">
            <span className="text-sm font-medium">{t.labelChapter}</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="chapterId" defaultValue={scene.chapterId ?? ""}>
              <option value="">{t.chapterNone}</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="block">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="scene-summary">{t.labelSummary}</label>
            <FieldCopyButton targetId="scene-summary" labels={copy} />
          </div>
          <textarea id="scene-summary" className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="summary" defaultValue={scene.summary ?? ""} />
        </div>
        <div className="block">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="scene-body">{t.labelBody}</label>
            <FieldCopyButton targetId="scene-body" labels={copy} />
          </div>
          <IndentTextarea
            id="scene-body"
            name="body"
            defaultValue={scene.body}
            required
            className="mt-1 min-h-64 w-full rounded border px-3 py-2 text-sm leading-7"
            formatLabel={t.indentFormat}
            hint={t.indentHint}
          />
        </div>
        <div className="flex items-center justify-between">
          <button className="rounded bg-black px-4 py-2 text-white" type="submit">
            {t.save}
          </button>
        </div>
      </form>

      <form className="mt-4" action={deleteScene}>
        <button className="rounded border border-red-600 px-4 py-2 text-sm text-red-600" type="submit">
          {t.delete}
        </button>
      </form>
    </main>
  );
}
