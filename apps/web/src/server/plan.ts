import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, type CountLimitKind } from "@/lib/plan-limits";

// Re-exported so existing importers keep working; the values themselves live
// in @/lib/plan-limits, which is Prisma-free and shared with the landing page.
export { PLAN_LIMITS };
export type { CountLimitKind };

type Limit = number | null;

export class PlanLimitError extends Error {
  constructor(
    message: string,
    public current: number,
    public limit: number,
  ) {
    super(message);
  }
}

export const getPlan = cache(async (userId: string) => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
    orderBy: { updatedAt: "desc" },
  });
  return subscription?.plan ?? "FREE";
});

function assertLimit(current: number, limit: Limit, message: string) {
  if (limit !== null && current >= limit) {
    throw new PlanLimitError(message, current, limit);
  }
}

export async function assertCanCreateProject(userId: string) {
  const plan = await getPlan(userId);
  const current = await prisma.project.count({ where: { userId, deletedAt: null } });
  assertLimit(current, PLAN_LIMITS[plan].projects, "Plus plan is required to create more projects.");
}

export async function assertCanAddScene(projectId: string, bodyLength: number) {
  const project = await prisma.project.findFirstOrThrow({ where: { id: projectId, deletedAt: null }, select: { userId: true } });
  const plan = await getPlan(project.userId);
  const scenes = await prisma.scene.findMany({ where: { projectId, deletedAt: null }, select: { body: true } });
  const current = scenes.reduce((sum, scene) => sum + scene.body.length, 0);
  const limit = PLAN_LIMITS[plan].bodyCharsPerProject;
  if (limit !== null && current + bodyLength > limit) {
    throw new PlanLimitError("Plus plan is required to add more body text to this project.", current + bodyLength, limit);
  }
}

export async function assertCountLimit(projectId: string, kind: CountLimitKind) {
  const project = await prisma.project.findFirstOrThrow({ where: { id: projectId, deletedAt: null }, select: { userId: true } });
  const plan = await getPlan(project.userId);
  const limit = PLAN_LIMITS[plan][kind];
  let current = 0;
  if (kind === "charactersPerProject") current = await prisma.character.count({ where: { projectId, deletedAt: null } });
  if (kind === "worldNotesPerProject") current = await prisma.worldNote.count({ where: { projectId, deletedAt: null } });
  if (kind === "foreshadowingsPerProject") current = await prisma.foreshadowing.count({ where: { projectId, deletedAt: null } });
  if (kind === "mysteriesPerProject") current = await prisma.mystery.count({ where: { projectId, deletedAt: null } });
  if (kind === "plotThreadsPerProject") current = await prisma.plotThread.count({ where: { projectId, deletedAt: null } });
  if (kind === "revisionTodosPerProject") current = await prisma.revisionTodo.count({ where: { projectId, deletedAt: null } });
  if (kind === "storySnapshotsPerProject") current = await prisma.storyStateSnapshot.count({ where: { projectId, deletedAt: null } });
  assertLimit(current, limit, "Plan limit exceeded for this project.");
}
