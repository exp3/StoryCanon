import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-[#f7f7f4] px-6 py-8 text-[#1d1d1b]">
      <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[70vh] flex-col justify-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#46605a]">Private story memory</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight">StoryCanon</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4b4b45]">
            ChatGPT で生まれた本文、キャラクター、世界観、伏線、TODO、現在の物語状態を、作品ごとの非公開ワークスペースに保存します。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded bg-[#1d1d1b] px-5 py-3 text-white" href="/login">
              ログインして始める
            </Link>
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-full rounded border border-[#d9d6cb] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">Latest story state</span>
              <span className="rounded bg-[#e4eee8] px-2 py-1 text-xs text-[#315247]">saved</span>
            </div>
            <div className="space-y-3 text-sm leading-6 text-[#4b4b45]">
              <p>主人公の目的、対立、未回収の要素を作品単位で追跡できます。</p>
              <p>未解決 TODO や伏線の状態をまとめて見返し、次の執筆判断につなげられます。</p>
              <p>生成シーンの保存先を一本化し、あとから MCP 経由の更新やロールバックも扱えます。</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
