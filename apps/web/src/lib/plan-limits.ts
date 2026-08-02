/**
 * Single source of truth for plan limits, shared by the server-side
 * enforcement in `@/server/plan`, the comparison table in /settings and the
 * pricing section on the landing page.
 *
 * Deliberately free of Prisma so it can be imported (and unit tested) without
 * instantiating a database client.
 */

export type CountLimitKind =
  | "charactersPerProject"
  | "worldNotesPerProject"
  | "foreshadowingsPerProject"
  | "mysteriesPerProject"
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
    mysteriesPerProject: 30,
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
    mysteriesPerProject: 100,
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
    mysteriesPerProject: 1000,
    plotThreadsPerProject: 1000,
    revisionTodosPerProject: 3000,
    storySnapshotsPerProject: 1000,
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

/** JSON export is the only non-numeric plan gate (see server/handlers.ts). */
export const JSON_EXPORT_BY_PLAN: Record<PlanName, boolean> = { FREE: false, PLUS: true, PRO: true };
