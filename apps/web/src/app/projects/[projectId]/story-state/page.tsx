import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/server/session";

export default async function StoryStatePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const snapshots = await prisma.storyStateSnapshot.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">物語状態の履歴</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          作品詳細へ戻る
        </Link>
      </div>
      <p className="mb-4 text-sm leading-6 text-[#4b4b45]">
        物語状態のスナップショットはChatGPT連携から保存されます。新しい順に表示しています。
      </p>
      {snapshots.length === 0 ? (
        <p className="text-sm text-[#555]">まだ物語状態のスナップショットがありません。</p>
      ) : (
        <ul className="space-y-4">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="rounded border bg-white p-4">
              <p className="text-xs text-[#666]">{snapshot.createdAt.toLocaleString("ja-JP")}</p>
              <p className="mt-2 text-sm leading-6 text-[#555]">{snapshot.summary}</p>
              {snapshot.recentEvents ? (
                <p className="mt-2 text-sm leading-6 text-[#555]">直近の出来事: {snapshot.recentEvents}</p>
              ) : null}
              {snapshot.unresolvedProblems ? (
                <p className="mt-2 text-sm leading-6 text-[#555]">未解決: {snapshot.unresolvedProblems}</p>
              ) : null}
              {snapshot.nextOptions ? (
                <p className="mt-2 text-sm leading-6 text-[#555]">次の選択肢: {snapshot.nextOptions}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
