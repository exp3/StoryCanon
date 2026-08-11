import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDictionary, localeTag } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { addSampleProject } from "./actions";

export default async function DashboardPage() {
  const user = await requireSessionUser("/dashboard");
  const t = getDictionary(user.locale).dashboard;

  const [projectCount, openTodoCount, openForeshadowingCount, recentProjects, mcpConnected] = await Promise.all([
    prisma.project.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.revisionTodo.count({
      where: {
        project: { userId: user.id, deletedAt: null },
        deletedAt: null,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    }),
    prisma.foreshadowing.count({
      where: {
        project: { userId: user.id, deletedAt: null },
        deletedAt: null,
        status: { in: ["UNPLANTED", "PLANTED", "IN_PROGRESS"] },
      },
    }),
    prisma.project.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, updatedAt: true },
    }),
    // "Connected" means an MCP client actually reached us, not that a token was
    // issued: issuing one and never using it is the most common way to stall.
    prisma.user
      .count({
        where: {
          id: user.id,
          OR: [
            { apiTokens: { some: { deletedAt: null, lastUsedAt: { not: null } } } },
            { oauthGrants: { some: {} } },
          ],
        },
      })
      .then((n) => n > 0),
  ]);

  const isEmpty = projectCount === 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t.title}</h1>
          <p className="mt-2 text-[#555]">{t.subtitle}</p>
        </div>
        <Link className="rounded bg-black px-4 py-2 text-white" href="/projects/new">
          {t.newProject}
        </Link>
      </header>

      {!isEmpty && !mcpConnected ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded border border-[#dedbd2] bg-[#f7f7f4] px-5 py-3">
          <p className="text-sm text-[#4b4b45]">{t.mcpBannerText}</p>
          <Link className="shrink-0 rounded border border-[#1d1d1b] px-4 py-1.5 text-sm font-bold" href="/settings#mcp">
            {t.mcpBannerCta}
          </Link>
        </div>
      ) : null}

      {isEmpty ? (
        <section>
          <h2 className="text-xl font-semibold">{t.startHeading}</h2>
          <p className="mt-2 max-w-[640px] text-sm leading-6 text-[#555]">{t.startLead}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="flex flex-col rounded border border-[#1d1d1b] bg-white p-5">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-semibold">{t.startConnectTitle}</h3>
                <span className="rounded-sm bg-[#e4eee8] px-2 py-0.5 text-[11px] font-bold text-[#315247]">
                  {t.startConnectBadge}
                </span>
              </div>
              <p className="mb-5 text-sm leading-6 text-[#555]">{t.startConnectBody}</p>
              <Link
                className="mt-auto inline-flex min-h-[42px] items-center justify-center rounded bg-[#1d1d1b] px-4 text-sm font-bold text-white"
                href="/settings#mcp"
              >
                {t.startConnectCta}
              </Link>
            </article>

            <article className="flex flex-col rounded border border-[#dedbd2] bg-white p-5">
              <h3 className="mb-2 font-semibold">{t.startSampleTitle}</h3>
              <p className="mb-5 text-sm leading-6 text-[#555]">{t.startSampleBody}</p>
              <form className="mt-auto" action={addSampleProject}>
                <button
                  className="inline-flex min-h-[42px] w-full items-center justify-center rounded border border-[#1d1d1b] px-4 text-sm font-bold"
                  type="submit"
                >
                  {t.startSampleCta}
                </button>
              </form>
            </article>

            <article className="flex flex-col rounded border border-[#dedbd2] bg-white p-5">
              <h3 className="mb-2 font-semibold">{t.startBlankTitle}</h3>
              <p className="mb-5 text-sm leading-6 text-[#555]">{t.startBlankBody}</p>
              <Link
                className="mt-auto inline-flex min-h-[42px] items-center justify-center rounded border border-[#1d1d1b] px-4 text-sm font-bold"
                href="/projects/new"
              >
                {t.startBlankCta}
              </Link>
            </article>
          </div>
        </section>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: t.statProjects, value: projectCount },
              { label: t.statOpenTodos, value: openTodoCount },
              { label: t.statActiveForeshadowing, value: openForeshadowingCount },
            ].map((item) => (
              <section key={item.label} className="rounded border bg-white p-5">
                <p className="text-sm text-[#666]">{item.label}</p>
                <p className="mt-4 text-3xl font-semibold">{item.value}</p>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t.recentProjects}</h2>
              <Link className="text-sm text-[#315247]" href="/projects">
                {t.viewAllProjects}
              </Link>
            </div>
            <ul className="space-y-3">
              {recentProjects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between rounded border border-[#ece8dd] px-4 py-3"
                >
                  <Link className="font-medium text-[#1d1d1b]" href={`/projects/${project.id}`}>
                    {project.title}
                  </Link>
                  <span className="text-sm text-[#666]">
                    {project.updatedAt.toLocaleString(localeTag(user.locale))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
