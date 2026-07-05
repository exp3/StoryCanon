import { prisma } from "@/lib/prisma";

type Limit = number | null;
export type CountLimitKind =
  | "charactersPerProject"
  | "worldNotesPerProject"
  | "foreshadowingsPerProject"
  | "plotThreadsPerProject"
  | "revisionTodosPerProject"
  | "storySnapshotsPerProject";

export const PLAN_LIMITS = {
  FREE: {
    projects: 3,
    charactersPerProject: 8,
    bodyCharsPerProject: 20000,
    worldNotesPerProject: 30,
    foreshadowingsPerProject: 30,
    plotThreadsPerProject: 30,
    revisionTodosPerProject: 50,
    storySnapshotsPerProject: 10,
  },
  PLUS: {
    projects: 50,
    charactersPerProject: 20,
    bodyCharsPerProject: 100000,
    worldNotesPerProject: 200,
    foreshadowingsPerProject: 100,
    plotThreadsPerProject: 100,
    revisionTodosPerProject: 300,
    storySnapshotsPerProject: 100,
  },
  PRO: {
    projects: 500,
    charactersPerProject: 200,
    bodyCharsPerProject: 1000000,
    worldNotesPerProject: 2000,
    foreshadowingsPerProject: 1000,
    plotThreadsPerProject: 1000,
    revisionTodosPerProject: 3000,
    storySnapshotsPerProject: 1000,
  },
} as const;

export class PlanLimitError extends Error {
  constructor(
    message: string,
    public current: number,
    public limit: number,
  ) {
    super(message);
  }
}

export async function getPlan(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
    orderBy: { updatedAt: "desc" },
  });
  return subscription?.plan ?? "FREE";
}

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
  if (kind === "plotThreadsPerProject") current = await prisma.plotThread.count({ where: { projectId, deletedAt: null } });
  if (kind === "revisionTodosPerProject") current = await prisma.revisionTodo.count({ where: { projectId, deletedAt: null } });
  if (kind === "storySnapshotsPerProject") current = await prisma.storyStateSnapshot.count({ where: { projectId, deletedAt: null } });
  assertLimit(current, limit, "Plan limit exceeded for this project.");
}
