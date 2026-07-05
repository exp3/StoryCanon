import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDictionary, localeTag } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";

export default async function ProjectsPage() {
  const user = await requireSessionUser("/projects");
  const t = getDictionary(user.locale).projectsList;
  const projects = await prisma.project.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      genre: true,
      premise: true,
      updatedAt: true,
      _count: { select: { scenes: { where: { deletedAt: null } } } },
    },
  });

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

      {projects.length === 0 ? (
        <section className="rounded border bg-white p-6">
          <p className="text-[#555]">{t.empty}</p>
        </section>
      ) : (
        <ul className="grid gap-4">
          {projects.map((project) => (
            <li key={project.id} className="rounded border bg-white p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <Link className="text-xl font-semibold text-[#1d1d1b]" href={`/projects/${project.id}`}>
                    {project.title}
                  </Link>
                  {project.genre ? <p className="mt-1 text-sm text-[#315247]">{project.genre}</p> : null}
                  {project.premise ? <p className="mt-3 text-sm leading-6 text-[#4b4b45]">{project.premise}</p> : null}
                </div>
                <div className="text-sm text-[#666]">
                  <p>
                    {t.sceneCount} {project._count.scenes}
                  </p>
                  <p className="mt-1">
                    {t.updatedAt} {project.updatedAt.toLocaleString(localeTag(user.locale))}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
