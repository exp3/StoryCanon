import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f7f4] px-6 py-8 text-[#1d1d1b]">
      <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[70vh] flex-col justify-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#46605a]">
            Private story memory
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight">
            StoryCanon
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4b4b45]">
            ChatGPT で生まれた小説本文、キャラクター、世界観、伏線、TODO、現在の物語状態を、作品ごとの非公開ワークスペースに保存します。
          </p>
          <div className="mt-8 flex gap-3">
            <Link className="rounded bg-[#1d1d1b] px-5 py-3 text-white" href="/dashboard">
              ダッシュボード
            </Link>
            <Link className="rounded border border-[#1d1d1b] px-5 py-3" href="/projects">
              作品一覧
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
              <p>主人公は軌道補給拠点の異常を発見。圧力センサーの値が後半の伏線になる。</p>
              <p>未解決: 補給網の漏れ、通信士の孤独、敵対組織の本当の目的。</p>
              <p>次回候補: 第2章冒頭で通信ログを調べる短いシーン。</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
