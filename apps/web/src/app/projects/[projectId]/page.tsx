import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/server/session";

function tabsFor(projectId: string) {
  return [
    { label: "概要", href: `/projects/${projectId}` },
    { label: "シーン", href: `/projects/${projectId}#scenes` },
    { label: "キャラクター", href: `/projects/${projectId}#characters` },
    { label: "世界観", href: `/projects/${projectId}#world-notes` },
    { label: "伏線", href: `/projects/${projectId}/foreshadowings` },
    { label: "プロット", href: `/projects/${projectId}/plot-threads` },
    { label: "TODO", href: `/projects/${projectId}/revision-todos` },
    { label: "物語状態", href: `/projects/${projectId}/story-state` },
    { label: "エクスポート", href: `/projects/${projectId}/export` },
  ];
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id, deletedAt: null },
    include: {
      scenes: {
        where: { deletedAt: null },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, summary: true, updatedAt: true },
      },
      characters: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, role: true, updatedAt: true },
      },
      worldNotes: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, category: true, updatedAt: true },
      },
      storyStateSnapshots: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { summary: true, unresolvedProblems: true, nextOptions: true, createdAt: true },
      },
      _count: {
        select: {
          scenes: true,
          characters: true,
          worldNotes: true,
          foreshadowings: true,
          plotThreads: true,
          revisionTodos: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const latestStoryState = project.storyStateSnapshots[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm text-[#666]">{project.id}</p>
        <h1 className="mt-1 text-3xl font-semibold">{project.title}</h1>
        {project.genre ? <p className="mt-2 text-sm text-[#315247]">{project.genre}</p> : null}
        {project.premise ? <p className="mt-4 max-w-3xl text-sm leading-6 text-[#555]">{project.premise}</p> : null}
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {tabsFor(project.id).map((tab) => (
          <Link key={tab.label} className="rounded border bg-white px-3 py-2 text-sm" href={tab.href}>
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section id="scenes" className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">シーン一覧</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#666]">{project._count.scenes} 件</span>
                <Link className="rounded border px-3 py-1 text-sm" href={`/projects/${project.id}/scenes/new`}>
                  + 新規シーン
                </Link>
              </div>
            </div>
            {project.scenes.length === 0 ? (
              <p className="text-sm text-[#555]">まだシーンがありません。</p>
            ) : (
              <ul className="space-y-3">
                {project.scenes.map((scene) => (
                  <li key={scene.id} className="rounded border border-[#ece8dd] px-4 py-3">
                    <Link className="flex items-center justify-between gap-4" href={`/projects/${project.id}/scenes/${scene.id}`}>
                      <div>
                        <p className="font-medium">{scene.title}</p>
                        {scene.summary ? <p className="mt-1 text-sm leading-6 text-[#555]">{scene.summary}</p> : null}
                      </div>
                      <span className="shrink-0 text-xs text-[#666]">{scene.updatedAt.toLocaleString("ja-JP")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="characters" className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">キャラクター</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#666]">{project._count.characters} 件</span>
                <Link className="rounded border px-3 py-1 text-sm" href={`/projects/${project.id}/characters/new`}>
                  + 新規キャラクター
                </Link>
              </div>
            </div>
            {project.characters.length === 0 ? (
              <p className="text-sm text-[#555]">まだキャラクターがありません。</p>
            ) : (
              <ul className="space-y-3">
                {project.characters.map((character) => (
                  <li key={character.id} className="rounded border border-[#ece8dd] px-4 py-3">
                    <Link
                      className="flex items-center justify-between gap-4"
                      href={`/projects/${project.id}/characters/${character.id}`}
                    >
                      <div>
                        <p className="font-medium">{character.name}</p>
                        {character.role ? <p className="mt-1 text-sm leading-6 text-[#555]">{character.role}</p> : null}
                      </div>
                      <span className="shrink-0 text-xs text-[#666]">{character.updatedAt.toLocaleString("ja-JP")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="world-notes" className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">世界観ノート</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#666]">{project._count.worldNotes} 件</span>
                <Link className="rounded border px-3 py-1 text-sm" href={`/projects/${project.id}/world-notes/new`}>
                  + 新規世界観ノート
                </Link>
              </div>
            </div>
            {project.worldNotes.length === 0 ? (
              <p className="text-sm text-[#555]">まだ世界観ノートがありません。</p>
            ) : (
              <ul className="space-y-3">
                {project.worldNotes.map((worldNote) => (
                  <li key={worldNote.id} className="rounded border border-[#ece8dd] px-4 py-3">
                    <Link
                      className="flex items-center justify-between gap-4"
                      href={`/projects/${project.id}/world-notes/${worldNote.id}`}
                    >
                      <div>
                        <p className="font-medium">{worldNote.title}</p>
                        <p className="mt-1 text-sm leading-6 text-[#555]">{worldNote.category}</p>
                      </div>
                      <span className="shrink-0 text-xs text-[#666]">{worldNote.updatedAt.toLocaleString("ja-JP")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: "伏線", value: project._count.foreshadowings, href: `/projects/${project.id}/foreshadowings` },
              { label: "プロットスレッド", value: project._count.plotThreads, href: `/projects/${project.id}/plot-threads` },
              { label: "TODO", value: project._count.revisionTodos, href: `/projects/${project.id}/revision-todos` },
            ].map((item) => (
              <Link key={item.label} className="rounded border bg-white p-4" href={item.href}>
                <p className="text-sm text-[#666]">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold">{item.value}</p>
              </Link>
            ))}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded border bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">最新の物語状態</h2>
              <Link className="text-xs text-[#4b4b45] underline" href={`/projects/${project.id}/story-state`}>
                履歴を見る
              </Link>
            </div>
            {latestStoryState ? (
              <div className="mt-3 space-y-3 text-sm leading-6 text-[#555]">
                <p>{latestStoryState.summary}</p>
                {latestStoryState.unresolvedProblems ? <p>未解決: {latestStoryState.unresolvedProblems}</p> : null}
                {latestStoryState.nextOptions ? <p>次の選択肢: {latestStoryState.nextOptions}</p> : null}
                <p className="text-xs text-[#666]">{latestStoryState.createdAt.toLocaleString("ja-JP")}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#555]">まだ Story State Snapshot が保存されていません。</p>
            )}
          </section>

          <section className="rounded border bg-white p-4">
            <h2 className="font-semibold">次の操作</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="rounded border px-3 py-2 text-center" href="/projects">
                作品一覧へ戻る
              </Link>
              <Link className="rounded border px-3 py-2 text-center" href="/projects/new">
                別の作品を作成
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
