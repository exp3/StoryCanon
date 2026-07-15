import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary, localeTag } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createStoryStateSnapshotSchema } from "@/server/validation";
import { CopyButton } from "@/components/copy-button";
import { EditableContent } from "@/components/editable-content";

export default async function StoryStatePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const t = getDictionary(user.locale).storyState;
  const copy = getDictionary(user.locale).common;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const snapshots = await prisma.storyStateSnapshot.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  async function createStoryState(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({
      where: { id: projectId, userId: currentUser.id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) notFound();

    const input = createStoryStateSnapshotSchema.parse({
      summary: String(formData.get("summary") ?? "").trim(),
      recentEvents: String(formData.get("recentEvents") ?? "").trim() || undefined,
      characterStates: String(formData.get("characterStates") ?? "").trim() || undefined,
      unresolvedProblems: String(formData.get("unresolvedProblems") ?? "").trim() || undefined,
      unresolvedForeshadowings: String(formData.get("unresolvedForeshadowings") ?? "").trim() || undefined,
      activePlotThreads: String(formData.get("activePlotThreads") ?? "").trim() || undefined,
      nextOptions: String(formData.get("nextOptions") ?? "").trim() || undefined,
      avoidElements: String(formData.get("avoidElements") ?? "").trim() || undefined,
      writingRules: String(formData.get("writingRules") ?? "").trim() || undefined,
      userPreferences: String(formData.get("userPreferences") ?? "").trim() || undefined,
    });
    await prisma.storyStateSnapshot.create({ data: { ...input, projectId } });
    redirect(`/projects/${projectId}/story-state`);
  }

  async function updateLatestStoryState(id: string, formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const latest = await prisma.storyStateSnapshot.findFirst({
      where: { projectId, deletedAt: null, project: { userId: currentUser.id, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latest || latest.id !== id) notFound();

    const input = createStoryStateSnapshotSchema.partial().parse({
      summary: String(formData.get("summary") ?? "").trim(),
      recentEvents: String(formData.get("recentEvents") ?? "").trim(),
      characterStates: String(formData.get("characterStates") ?? "").trim(),
      unresolvedProblems: String(formData.get("unresolvedProblems") ?? "").trim(),
      unresolvedForeshadowings: String(formData.get("unresolvedForeshadowings") ?? "").trim(),
      activePlotThreads: String(formData.get("activePlotThreads") ?? "").trim(),
      nextOptions: String(formData.get("nextOptions") ?? "").trim(),
      avoidElements: String(formData.get("avoidElements") ?? "").trim(),
      writingRules: String(formData.get("writingRules") ?? "").trim(),
      userPreferences: String(formData.get("userPreferences") ?? "").trim(),
    });
    await prisma.storyStateSnapshot.update({ where: { id: latest.id }, data: input });
    redirect(`/projects/${projectId}/story-state`);
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
      <details className="mb-6 rounded border bg-white p-4" open={snapshots.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">{t.addNew}</summary>
        <h2 className="mb-3 mt-4 font-semibold">{t.createHeading}</h2>
        <form className="space-y-4" action={createStoryState}>
          {[
            { name: "summary", label: t.summaryLabel, required: true },
            { name: "recentEvents", label: t.recentEventsFormLabel },
            { name: "characterStates", label: t.characterStatesLabel },
            { name: "unresolvedProblems", label: t.unresolvedProblemsLabel },
            { name: "unresolvedForeshadowings", label: t.unresolvedForeshadowingsLabel },
            { name: "activePlotThreads", label: t.activePlotThreadsLabel },
            { name: "nextOptions", label: t.nextOptionsFormLabel },
            { name: "avoidElements", label: t.avoidElementsLabel },
            { name: "writingRules", label: t.writingRulesLabel },
            { name: "userPreferences", label: t.userPreferencesLabel },
          ].map((field) => (
            <label className="block" key={field.name}>
              <span className="text-sm font-medium">{field.label}</span>
              <textarea className="mt-1 min-h-24 w-full rounded border px-3 py-2" name={field.name} required={field.required} />
            </label>
          ))}
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">{t.create}</button>
        </form>
      </details>
      {snapshots.length === 0 ? (
        <p className="text-sm text-[#555]">{t.empty}</p>
      ) : (
        <ul className="space-y-4">
          {snapshots.map((snapshot, index) => {
            const content = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-[#666]">
                    {index === 0 ? <span className="mr-2 rounded bg-[#ece8dd] px-2 py-0.5">{t.latestLabel}</span> : null}
                    {snapshot.createdAt.toLocaleString(localeTag(user.locale))}
                  </p>
                  <CopyButton
                    labels={copy}
                    value={[
                      snapshot.summary,
                      snapshot.recentEvents ? `${t.recentEventsLabel} ${snapshot.recentEvents}` : "",
                      snapshot.characterStates ? `${t.characterStatesLabel}: ${snapshot.characterStates}` : "",
                      snapshot.unresolvedProblems ? `${t.unresolvedLabel} ${snapshot.unresolvedProblems}` : "",
                      snapshot.unresolvedForeshadowings ? `${t.unresolvedForeshadowingsLabel}: ${snapshot.unresolvedForeshadowings}` : "",
                      snapshot.activePlotThreads ? `${t.activePlotThreadsLabel}: ${snapshot.activePlotThreads}` : "",
                      snapshot.nextOptions ? `${t.nextOptionsLabel} ${snapshot.nextOptions}` : "",
                      snapshot.avoidElements ? `${t.avoidElementsLabel}: ${snapshot.avoidElements}` : "",
                      snapshot.writingRules ? `${t.writingRulesLabel}: ${snapshot.writingRules}` : "",
                      snapshot.userPreferences ? `${t.userPreferencesLabel}: ${snapshot.userPreferences}` : "",
                    ].filter(Boolean).join("\n")}
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-[#555]">{snapshot.summary}</p>
                {snapshot.recentEvents ? <p className="mt-2 text-sm leading-6 text-[#555]">{t.recentEventsLabel} {snapshot.recentEvents}</p> : null}
                {snapshot.unresolvedProblems ? <p className="mt-2 text-sm leading-6 text-[#555]">{t.unresolvedLabel} {snapshot.unresolvedProblems}</p> : null}
                {snapshot.nextOptions ? <p className="mt-2 text-sm leading-6 text-[#555]">{t.nextOptionsLabel} {snapshot.nextOptions}</p> : null}
              </>
            );

            return (
              <li key={snapshot.id} className="rounded border bg-white p-4">
                {index === 0 ? (
                  <EditableContent
                    action={updateLatestStoryState.bind(null, snapshot.id)}
                    labels={{ edit: copy.edit, save: copy.saveChanges, cancel: copy.cancel }}
                    fields={[
                      { name: "summary", label: t.summaryLabel, value: snapshot.summary, kind: "textarea", required: true },
                      { name: "recentEvents", label: t.recentEventsFormLabel, value: snapshot.recentEvents ?? "", kind: "textarea" },
                      { name: "characterStates", label: t.characterStatesLabel, value: snapshot.characterStates ?? "", kind: "textarea" },
                      { name: "unresolvedProblems", label: t.unresolvedProblemsLabel, value: snapshot.unresolvedProblems ?? "", kind: "textarea" },
                      { name: "unresolvedForeshadowings", label: t.unresolvedForeshadowingsLabel, value: snapshot.unresolvedForeshadowings ?? "", kind: "textarea" },
                      { name: "activePlotThreads", label: t.activePlotThreadsLabel, value: snapshot.activePlotThreads ?? "", kind: "textarea" },
                      { name: "nextOptions", label: t.nextOptionsFormLabel, value: snapshot.nextOptions ?? "", kind: "textarea" },
                      { name: "avoidElements", label: t.avoidElementsLabel, value: snapshot.avoidElements ?? "", kind: "textarea" },
                      { name: "writingRules", label: t.writingRulesLabel, value: snapshot.writingRules ?? "", kind: "textarea" },
                      { name: "userPreferences", label: t.userPreferencesLabel, value: snapshot.userPreferences ?? "", kind: "textarea" },
                    ]}
                  >
                    {content}
                  </EditableContent>
                ) : content}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
