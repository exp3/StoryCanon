import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-[#555]">作品、未対応 TODO、物語状態を確認します。</p>
        </div>
        <Link className="rounded bg-black px-4 py-2 text-white" href="/projects/new">
          新規作品
        </Link>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {["Projects", "Open todos", "Foreshadowings"].map((label) => (
          <section key={label} className="rounded border bg-white p-5">
            <p className="text-sm text-[#666]">{label}</p>
            <p className="mt-4 text-3xl font-semibold">0</p>
          </section>
        ))}
      </div>
    </main>
  );
}
