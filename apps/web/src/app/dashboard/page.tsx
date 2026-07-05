import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/server/session";

export default async function DashboardPage() {
  const user = await requireSessionUser("/dashboard");

  const [projectCount, openTodoCount, openForeshadowingCount, recentProjects] = await Promise.all([
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
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">ダッシュボード</h1>
          <p className="mt-2 text-[#555]">作品、未対応 TODO、伏線の進行状況をここから確認します。</p>
        </div>
        <Link className="rounded bg-black px-4 py-2 text-white" href="/projects/new">
          新規作品
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "作品数", value: projectCount },
          { label: "未対応 TODO", value: openTodoCount },
          { label: "進行中の伏線", value: openForeshadowingCount },
        ].map((item) => (
          <section key={item.label} className="rounded border bg-white p-5">
            <p className="text-sm text-[#666]">{item.label}</p>
            <p className="mt-4 text-3xl font-semibold">{item.value}</p>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近更新した作品</h2>
          <Link className="text-sm text-[#315247]" href="/projects">
            作品一覧へ
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <p className="text-sm text-[#555]">まだ作品がありません。最初の作品を作成してください。</p>
        ) : (
          <ul className="space-y-3">
            {recentProjects.map((project) => (
              <li key={project.id} className="flex items-center justify-between rounded border border-[#ece8dd] px-4 py-3">
                <Link className="font-medium text-[#1d1d1b]" href={`/projects/${project.id}`}>
                  {project.title}
                </Link>
                <span className="text-sm text-[#666]">{project.updatedAt.toLocaleString("ja-JP")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
