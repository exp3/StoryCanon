import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary, localeTag, type Dictionary, type Locale } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";

function tabsFor(projectId: string, t: Dictionary["projectDetail"]) {
  return [
    { label: t.tabOverview, href: `/projects/${projectId}` },
    { label: t.tabRead, href: `/projects/${projectId}/read` },
    { label: t.tabScenes, href: `/projects/${projectId}#scenes` },
    { label: t.tabCharacters, href: `/projects/${projectId}#characters` },
    { label: t.tabWorldNotes, href: `/projects/${projectId}#world-notes` },
    { label: t.tabForeshadowings, href: `/projects/${projectId}/foreshadowings` },
    { label: t.tabPlotThreads, href: `/projects/${projectId}/plot-threads` },
    { label: t.tabRevisionTodos, href: `/projects/${projectId}/revision-todos` },
    { label: t.tabStoryState, href: `/projects/${projectId}/story-state` },
    { label: t.tabExport, href: `/projects/${projectId}/export` },
  ];
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const locale: Locale = user.locale;
  const t = getDictionary(locale).projectDetail;

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
        {tabsFor(project.id, t).map((tab) => (
          <Link key={tab.label} className="rounded border bg-white px-3 py-2 text-sm" href={tab.href}>
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section id="scenes" className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{t.scenesHeading}</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#666]">
                  {project._count.scenes} {t.scenesUnit}
                </span>
                <Link className="rounded border px-3 py-1 text-sm" href={`/projects/${project.id}/scenes/new`}>
                  {t.newScene}
                </Link>
              </div>
            </div>
            {project.scenes.length === 0 ? (
              <p className="text-sm text-[#555]">{t.emptyScenes}</p>
            ) : (
              <ul className="space-y-3">
                {project.scenes.map((scene) => (
                  <li key={scene.id} className="rounded border border-[#ece8dd] px-4 py-3">
                    <Link className="flex items-center justify-between gap-4" href={`/projects/${project.id}/scenes/${scene.id}`}>
                      <div>
                        <p className="font-medium">{scene.title}</p>
                        {scene.summary ? <p className="mt-1 text-sm leading-6 text-[#555]">{scene.summary}</p> : null}
                      </div>
                      <span className="shrink-0 text-xs text-[#666]">{scene.updatedAt.toLocaleString(localeTag(locale))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="characters" className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{t.charactersHeading}</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#666]">{project._count.characters}</span>
                <Link className="rounded border px-3 py-1 text-sm" href={`/projects/${project.id}/characters/new`}>
                  {t.newCharacter}
                </Link>
              </div>
            </div>
            {project.characters.length === 0 ? (
              <p className="text-sm text-[#555]">{t.emptyCharacters}</p>
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
                      <span className="shrink-0 text-xs text-[#666]">
                        {character.updatedAt.toLocaleString(localeTag(locale))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="world-notes" className="rounded border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{t.worldNotesHeading}</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#666]">{project._count.worldNotes}</span>
                <Link className="rounded border px-3 py-1 text-sm" href={`/projects/${project.id}/world-notes/new`}>
                  {t.newWorldNote}
                </Link>
              </div>
            </div>
            {project.worldNotes.length === 0 ? (
              <p className="text-sm text-[#555]">{t.emptyWorldNotes}</p>
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
                      <span className="shrink-0 text-xs text-[#666]">
                        {worldNote.updatedAt.toLocaleString(localeTag(locale))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: t.statForeshadowings, value: project._count.foreshadowings, href: `/projects/${project.id}/foreshadowings` },
              { label: t.statPlotThreads, value: project._count.plotThreads, href: `/projects/${project.id}/plot-threads` },
              { label: t.statRevisionTodos, value: project._count.revisionTodos, href: `/projects/${project.id}/revision-todos` },
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
              <h2 className="font-semibold">{t.latestStoryStateHeading}</h2>
              <Link className="text-xs text-[#4b4b45] underline" href={`/projects/${project.id}/story-state`}>
                {t.viewHistory}
              </Link>
            </div>
            {latestStoryState ? (
              <div className="mt-3 space-y-3 text-sm leading-6 text-[#555]">
                <p>{latestStoryState.summary}</p>
                {latestStoryState.unresolvedProblems ? (
                  <p>
                    {t.unresolvedLabel} {latestStoryState.unresolvedProblems}
                  </p>
                ) : null}
                {latestStoryState.nextOptions ? (
                  <p>
                    {t.nextOptionsLabel} {latestStoryState.nextOptions}
                  </p>
                ) : null}
                <p className="text-xs text-[#666]">{latestStoryState.createdAt.toLocaleString(localeTag(locale))}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#555]">{t.emptyStoryState}</p>
            )}
          </section>

          <section className="rounded border bg-white p-4">
            <h2 className="font-semibold">{t.nextActionsHeading}</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="rounded border px-3 py-2 text-center" href="/projects">
                {t.backToProjects}
              </Link>
              <Link className="rounded border px-3 py-2 text-center" href="/projects/new">
                {t.createAnotherProject}
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
