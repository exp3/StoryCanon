import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/server/session";

export default async function ProjectsPage() {
  const user = await requireSessionUser("/projects");
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
          <h1 className="text-3xl font-semibold">作品一覧</h1>
          <p className="mt-2 text-[#555]">保存済みの作品を開き、本文や補助データを更新できます。</p>
        </div>
        <Link className="rounded bg-black px-4 py-2 text-white" href="/projects/new">
          新規作品
        </Link>
      </header>

      {projects.length === 0 ? (
        <section className="rounded border bg-white p-6">
          <p className="text-[#555]">まだ作品がありません。新規作品を作成すると、ここに表示されます。</p>
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
                  <p>シーン数: {project._count.scenes}</p>
                  <p className="mt-1">更新日時: {project.updatedAt.toLocaleString("ja-JP")}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
