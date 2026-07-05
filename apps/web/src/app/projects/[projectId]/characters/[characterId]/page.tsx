import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createCharacterSchema } from "@/server/validation";

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; characterId: string }>;
}) {
  const user = await requireSessionUser();
  const { projectId, characterId } = await params;
  const t = getDictionary(user.locale).characterDetail;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const character = await prisma.character.findFirst({ where: { id: characterId, projectId, deletedAt: null } });
  if (!character) notFound();

  const notes = await prisma.characterNote.findMany({
    where: { characterId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  async function updateCharacter(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({ where: { id: projectId, userId: currentUser.id, deletedAt: null } });
    if (!owned) notFound();

    const parsed = createCharacterSchema.partial().parse({
      name: String(formData.get("name") ?? ""),
      role: String(formData.get("role") ?? "") || undefined,
      age: String(formData.get("age") ?? "") || undefined,
      personality: String(formData.get("personality") ?? "") || undefined,
      speechStyle: String(formData.get("speechStyle") ?? "") || undefined,
      appearance: String(formData.get("appearance") ?? "") || undefined,
      background: String(formData.get("background") ?? "") || undefined,
      goal: String(formData.get("goal") ?? "") || undefined,
      secret: String(formData.get("secret") ?? "") || undefined,
      currentState: String(formData.get("currentState") ?? "") || undefined,
    });

    await prisma.character.update({ where: { id: characterId }, data: parsed });
    redirect(`/projects/${projectId}/characters/${characterId}`);
  }

  async function deleteCharacter() {
    "use server";

    const currentUser = await requireSessionUser();
    const owned = await prisma.project.findFirst({ where: { id: projectId, userId: currentUser.id, deletedAt: null } });
    if (!owned) notFound();

    await prisma.character.update({ where: { id: characterId }, data: { deletedAt: new Date() } });
    redirect(`/projects/${projectId}`);
  }

  const fields: Array<[string, keyof typeof character, boolean]> = [
    [t.labelRole, "role", false],
    [t.labelAge, "age", false],
    [t.labelPersonality, "personality", true],
    [t.labelSpeechStyle, "speechStyle", true],
    [t.labelAppearance, "appearance", true],
    [t.labelBackground, "background", true],
    [t.labelGoal, "goal", true],
    [t.labelSecret, "secret", true],
    [t.labelCurrentState, "currentState", true],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}`}>
          {t.backToProject}
        </Link>
      </div>

      <form className="space-y-4 rounded border bg-white p-6" action={updateCharacter}>
        <label className="block">
          <span className="text-sm font-medium">{t.labelName}</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="name" defaultValue={character.name} required />
        </label>
        {fields.map(([label, key, multiline]) =>
          multiline ? (
            <label className="block" key={key}>
              <span className="text-sm font-medium">{label}</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded border px-3 py-2"
                name={key}
                defaultValue={(character[key] as string) ?? ""}
              />
            </label>
          ) : (
            <label className="block" key={key}>
              <span className="text-sm font-medium">{label}</span>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                name={key}
                defaultValue={(character[key] as string) ?? ""}
              />
            </label>
          )
        )}
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">
          {t.save}
        </button>
      </form>

      <section className="mt-6 rounded border bg-white p-6">
        <h2 className="mb-3 font-semibold">{t.notesHeading}</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-[#555]">{t.notesEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded border border-[#ece8dd] px-4 py-3">
                {note.title ? <p className="font-medium">{note.title}</p> : null}
                <p className="mt-1 text-sm leading-6 text-[#555]">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="mt-4" action={deleteCharacter}>
        <button className="rounded border border-red-600 px-4 py-2 text-sm text-red-600" type="submit">
          {t.delete}
        </button>
      </form>
    </main>
  );
}
