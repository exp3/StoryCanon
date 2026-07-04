import Link from "next/link";

export default function ProjectsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Projects</h1>
        <Link className="rounded bg-black px-4 py-2 text-white" href="/projects/new">
          新規作品
        </Link>
      </header>
      <section className="rounded border bg-white p-6">
        <p className="text-[#555]">API または ChatGPT 連携から作品を作成すると、ここに表示します。</p>
      </section>
    </main>
  );
}
