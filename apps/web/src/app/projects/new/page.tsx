import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { assertCanCreateProject } from "@/server/plan";
import { requireSessionUser } from "@/server/session";
import { createProjectSchema, projectFieldLimits } from "@/server/validation";

export default async function NewProjectPage() {
  const user = await requireSessionUser("/projects/new");
  const t = getDictionary(user.locale).projectNew;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold">{t.title}</h1>
      <form
        className="space-y-4 rounded border bg-white p-6"
        action={async (formData) => {
          "use server";

          const user = await requireSessionUser("/projects/new");
          await assertCanCreateProject(user.id);

          const parsed = createProjectSchema.parse({
            title: String(formData.get("title") ?? ""),
            genre: String(formData.get("genre") ?? "") || undefined,
            premise: String(formData.get("premise") ?? "") || undefined,
            tone: String(formData.get("tone") ?? "") || undefined,
          });

          const project = await prisma.project.create({
            data: {
              userId: user.id,
              title: parsed.title,
              genre: parsed.genre,
              premise: parsed.premise,
              tone: parsed.tone,
            },
            select: { id: true },
          });

          redirect(`/projects/${project.id}`);
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">{t.labelTitle}</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="title" required maxLength={projectFieldLimits.title} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelGenre}</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="genre" maxLength={projectFieldLimits.genre} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelPremise}</span>
          <textarea className="mt-1 min-h-32 w-full rounded border px-3 py-2" name="premise" maxLength={projectFieldLimits.premise} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.labelTone}</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="tone" maxLength={projectFieldLimits.tone} />
        </label>
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">
          {t.save}
        </button>
      </form>
    </main>
  );
}
