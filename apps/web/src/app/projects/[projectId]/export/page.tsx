import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/server/plan";
import { requireSessionUser } from "@/server/session";

export default async function ExportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const plan = await getPlan(user.id);
  const canExportJson = plan !== "FREE";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">エクスポート</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          作品詳細へ戻る
        </Link>
      </div>
      <div className="space-y-3 rounded border bg-white p-6">
        <div className="flex items-center justify-between rounded border border-[#ece8dd] px-4 py-3">
          <div>
            <p className="font-medium">Markdown</p>
            <p className="mt-1 text-sm text-[#555]">章・シーン・キャラクターなどをまとめたMarkdownファイル</p>
          </div>
          <a className="rounded bg-black px-4 py-2 text-sm text-white" href={`/api/projects/${projectId}/export/markdown`}>
            ダウンロード
          </a>
        </div>
        <div className="flex items-center justify-between rounded border border-[#ece8dd] px-4 py-3">
          <div>
            <p className="font-medium">JSON</p>
            <p className="mt-1 text-sm text-[#555]">
              全データを含む構造化JSON{canExportJson ? "" : "(Plusプラン以上で利用可能)"}
            </p>
          </div>
          {canExportJson ? (
            <a className="rounded bg-black px-4 py-2 text-sm text-white" href={`/api/projects/${projectId}/export/json`}>
              ダウンロード
            </a>
          ) : (
            <span className="rounded bg-[#dedbd2] px-4 py-2 text-sm text-[#666]">利用不可</span>
          )}
        </div>
      </div>
    </main>
  );
}
