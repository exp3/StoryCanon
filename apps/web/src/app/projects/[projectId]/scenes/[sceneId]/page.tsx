import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/server/session";
import { createSceneSchema } from "@/server/validation";

export default async function SceneDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sceneId: string }>;
}) {
  const user = await requireSessionUser();
  const { projectId, sceneId } = await params;

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
        <h1 className="text-3xl font-semibold">シーン編集</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          作品詳細へ戻る
        </Link>
      </div>

      <form className="space-y-4 rounded border bg-white p-6" action={updateScene}>
        <label className="block">
          <span className="text-sm font-medium">タイトル</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="title" defaultValue={scene.title} required />
        </label>
        {chapters.length > 0 ? (
          <label className="block">
            <span className="text-sm font-medium">章(任意)</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="chapterId" defaultValue={scene.chapterId ?? ""}>
              <option value="">未設定</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium">要約(任意)</span>
          <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="summary" defaultValue={scene.summary ?? ""} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">本文</span>
          <textarea
            className="mt-1 min-h-64 w-full rounded border px-3 py-2 font-mono text-sm"
            name="body"
            defaultValue={scene.body}
            required
          />
        </label>
        <div className="flex items-center justify-between">
          <button className="rounded bg-black px-4 py-2 text-white" type="submit">
            保存
          </button>
        </div>
      </form>

      <form className="mt-4" action={deleteScene}>
        <button className="rounded border border-red-600 px-4 py-2 text-sm text-red-600" type="submit">
          このシーンを削除
        </button>
      </form>
    </main>
  );
}
