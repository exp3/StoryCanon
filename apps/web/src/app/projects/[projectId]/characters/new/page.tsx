import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/server/session";
import { createCharacterSchema } from "@/server/validation";

export default async function NewCharacterPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireSessionUser();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold">新規キャラクター</h1>
      <form
        className="space-y-4 rounded border bg-white p-6"
        action={async (formData) => {
          "use server";

          const currentUser = await requireSessionUser();
          const owned = await prisma.project.findFirst({ where: { id: projectId, userId: currentUser.id, deletedAt: null } });
          if (!owned) notFound();

          const parsed = createCharacterSchema.parse({
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

          const character = await prisma.character.create({ data: { ...parsed, projectId }, select: { id: true } });
          redirect(`/projects/${projectId}/characters/${character.id}`);
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">名前</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="name" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">役割</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="role" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">年齢</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="age" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">性格</span>
          <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="personality" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">話し方</span>
          <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="speechStyle" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">外見</span>
          <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="appearance" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">背景</span>
          <textarea className="mt-1 min-h-24 w-full rounded border px-3 py-2" name="background" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">目的</span>
          <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="goal" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">秘密</span>
          <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="secret" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">現在の状態</span>
          <textarea className="mt-1 min-h-24 w-full rounded border px-3 py-2" name="currentState" />
        </label>
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">
          保存
        </button>
      </form>
    </main>
  );
}
