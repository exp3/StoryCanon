import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { Reader, type ReaderScene } from "./reader";

export default async function ReadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).reader;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!project) notFound();

  const [chapters, scenes, progress] = await Promise.all([
    prisma.chapter.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, title: true },
    }),
    prisma.scene.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, body: true, chapterId: true },
    }),
    prisma.readingProgress.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
      select: { sceneId: true, scrollRatio: true },
    }),
  ]);

  const chapterTitles = new Map(chapters.map((c) => [c.id, c.title]));
  const readerScenes: ReaderScene[] = scenes.map((scene) => ({
    id: scene.id,
    title: scene.title,
    body: scene.body,
    chapterTitle: scene.chapterId ? chapterTitles.get(scene.chapterId) ?? null : null,
  }));

  return (
    <main className="min-h-screen bg-[#faf8f2]">
      <div className="mx-auto flex max-w-[42rem] items-center justify-between px-6 pt-6">
        <h1 className="text-sm font-medium text-[#4b4b45]">{project.title}</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${project.id}`}>
          {t.backToProject}
        </Link>
      </div>

      {readerScenes.length === 0 ? (
        <p className="mx-auto max-w-[42rem] px-6 py-24 text-center text-sm text-[#666]">{t.empty}</p>
      ) : (
        <Reader
          projectId={project.id}
          scenes={readerScenes}
          initial={progress ?? null}
          labels={{ autoSaved: t.autoSaved, resumed: t.resumed, empty: t.empty }}
        />
      )}
    </main>
  );
}
