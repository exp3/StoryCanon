const tabs = [
  "Overview",
  "Scenes",
  "Characters",
  "World Notes",
  "Foreshadowings",
  "Plot Threads",
  "Todos",
  "Story State",
  "Export",
];

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm text-[#666]">{params.projectId}</p>
        <h1 className="mt-1 text-3xl font-semibold">Project detail</h1>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab} className="rounded border bg-white px-3 py-2 text-sm" type="button">
            {tab}
          </button>
        ))}
      </nav>
      <section className="grid gap-4 md:grid-cols-[1fr_320px]">
        <textarea className="min-h-[520px] rounded border bg-white p-4" placeholder="本文またはメモ" />
        <aside className="rounded border bg-white p-4">
          <h2 className="font-semibold">Story State</h2>
          <p className="mt-3 text-sm leading-6 text-[#555]">最新のあらすじ、未解決の伏線、次回候補を表示します。</p>
        </aside>
      </section>
    </main>
  );
}
