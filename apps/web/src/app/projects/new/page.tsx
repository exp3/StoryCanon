export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold">New Project</h1>
      <form className="space-y-4 rounded border bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium">タイトル</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="title" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">ジャンル</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="genre" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">概要</span>
          <textarea className="mt-1 min-h-32 w-full rounded border px-3 py-2" name="premise" />
        </label>
        <button className="rounded bg-black px-4 py-2 text-white" type="button">
          保存
        </button>
      </form>
    </main>
  );
}
