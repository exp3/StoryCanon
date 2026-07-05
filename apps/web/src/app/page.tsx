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
            Save the body text, characters, world notes, foreshadowing, TODOs, and current story state generated in
            ChatGPT into a private workspace for each project.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded bg-[#1d1d1b] px-5 py-3 text-white" href="/login">
              Log in to get started
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
              <p>Track the protagonist&apos;s goals, conflicts, and unresolved threads per project.</p>
              <p>Review open TODOs and foreshadowing status together to decide what to write next.</p>
              <p>Keep generated scenes in one place, with updates and rollback available via MCP later.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
