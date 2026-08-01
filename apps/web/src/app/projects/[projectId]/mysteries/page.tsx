import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createMysterySchema } from "@/server/validation";
import { CopyButton } from "@/components/copy-button";
import { EditableContent } from "@/components/editable-content";

const scopes = ["CENTRAL", "ARC", "EPISODE", "SCENE"];

export default async function MysteriesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).mysteries;
  const copy = getDictionary(user.locale).common;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const mysteries = await prisma.mystery.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  async function createMystery(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({
      where: { id: projectId, userId: currentUser.id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) notFound();

    const input = createMysterySchema.parse({
      scope: String(formData.get("scope") ?? "") || undefined,
      question: String(formData.get("question") ?? "").trim(),
      truth: String(formData.get("truth") ?? "").trim() || undefined,
      knownBy: String(formData.get("knownBy") ?? "").trim() || undefined,
      clues: String(formData.get("clues") ?? "").trim() || undefined,
      revealPoint: String(formData.get("revealPoint") ?? "").trim() || undefined,
    });
    await prisma.mystery.create({ data: { ...input, projectId } });
    redirect(`/projects/${projectId}/mysteries`);
  }

  async function updateMystery(id: string, formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.mystery.findFirst({
      where: { id, projectId, deletedAt: null, project: { userId: currentUser.id, deletedAt: null } },
      select: { id: true },
    });
    if (!owned) notFound();

    const input = createMysterySchema.partial().parse({
      scope: String(formData.get("scope") ?? ""),
      question: String(formData.get("question") ?? "").trim(),
      truth: String(formData.get("truth") ?? "").trim(),
      knownBy: String(formData.get("knownBy") ?? "").trim(),
      clues: String(formData.get("clues") ?? "").trim(),
      revealPoint: String(formData.get("revealPoint") ?? "").trim(),
    });
    await prisma.mystery.update({ where: { id: owned.id }, data: input });
    redirect(`/projects/${projectId}/mysteries`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          {t.backToProject}
        </Link>
      </div>
      <p className="mb-4 text-sm leading-6 text-[#4b4b45]">{t.description}</p>
      <details className="mb-6 rounded border bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">{t.addNew}</summary>
        <form className="mt-4 space-y-4" action={createMystery}>
          <label className="block">
            <span className="text-sm font-medium">{t.scopeLabel}</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="scope" defaultValue="CENTRAL">
              {scopes.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.questionLabel}</span>
            <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="question" required />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.truthLabel}</span>
            <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="truth" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.knownByLabel}</span>
            <input className="mt-1 w-full rounded border px-3 py-2" name="knownBy" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.cluesLabel}</span>
            <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="clues" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.revealPointLabel}</span>
            <input className="mt-1 w-full rounded border px-3 py-2" name="revealPoint" />
          </label>
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">{t.create}</button>
        </form>
      </details>
      {mysteries.length === 0 ? (
        <p className="text-sm text-[#555]">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {mysteries.map((item) => (
            <li key={item.id} className="rounded border bg-white p-4">
              <EditableContent
                action={updateMystery.bind(null, item.id)}
                labels={{ edit: copy.edit, save: copy.saveChanges, cancel: copy.cancel }}
                fields={[
                  { name: "scope", label: t.scopeLabel, value: item.scope, kind: "select", options: scopes },
                  { name: "question", label: t.questionLabel, value: item.question, kind: "textarea", required: true },
                  { name: "truth", label: t.truthLabel, value: item.truth ?? "", kind: "textarea" },
                  { name: "knownBy", label: t.knownByLabel, value: item.knownBy ?? "" },
                  { name: "clues", label: t.cluesLabel, value: item.clues ?? "", kind: "textarea" },
                  { name: "revealPoint", label: t.revealPointLabel, value: item.revealPoint ?? "" },
                ]}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{item.question}</p>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-[#666]">{item.scope}</span>
                    <CopyButton
                      labels={copy}
                      value={[
                        `[${item.scope}] ${item.question}`,
                        item.truth ? `${t.truthLabel}: ${item.truth}` : "",
                        item.knownBy ? `${t.knownByLabel}: ${item.knownBy}` : "",
                        item.clues ? `${t.cluesLabel}: ${item.clues}` : "",
                        item.revealPoint ? `${t.revealPointLabel}: ${item.revealPoint}` : "",
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    />
                  </div>
                </div>
                {item.truth ? (
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    {t.truthLabel}: {item.truth}
                  </p>
                ) : null}
                {item.knownBy ? (
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    {t.knownByLabel}: {item.knownBy}
                  </p>
                ) : null}
                {item.clues ? (
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    {t.cluesLabel}: {item.clues}
                  </p>
                ) : null}
                {item.revealPoint ? (
                  <p className="mt-2 text-sm leading-6 text-[#555]">
                    {t.revealPointLabel}: {item.revealPoint}
                  </p>
                ) : null}
              </EditableContent>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
