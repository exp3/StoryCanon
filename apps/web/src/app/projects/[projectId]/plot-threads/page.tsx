import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/server/session";

export default async function PlotThreadsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const plotThreads = await prisma.plotThread.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">プロットスレッド一覧</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          作品詳細へ戻る
        </Link>
      </div>
      <p className="mb-4 text-sm leading-6 text-[#4b4b45]">
        プロットスレッドはChatGPT連携から保存されます。ここでは一覧の確認のみ行えます。
      </p>
      {plotThreads.length === 0 ? (
        <p className="text-sm text-[#555]">まだプロットスレッドがありません。</p>
      ) : (
        <ul className="space-y-3">
          {plotThreads.map((item) => (
            <li key={item.id} className="rounded border bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium">{item.title}</p>
                <span className="shrink-0 text-xs text-[#666]">{item.status}</span>
              </div>
              {item.description ? <p className="mt-2 text-sm leading-6 text-[#555]">{item.description}</p> : null}
              {item.currentState ? <p className="mt-2 text-sm leading-6 text-[#555]">現在の状態: {item.currentState}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
