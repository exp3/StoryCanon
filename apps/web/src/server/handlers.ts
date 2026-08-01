import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PlanLimitError, assertCanAddScene, assertCanCreateProject, assertCountLimit, getPlan } from "./plan";
import { renderMarkdown, renderPlainText } from "./export";
import {
  createChapterSchema,
  createCharacterNoteSchema,
  createCharacterSchema,
  createForeshadowingSchema,
  createMysterySchema,
  createPlotThreadSchema,
  createProjectSchema,
  createRevisionTodoSchema,
  createSceneSchema,
  createStoryStateSnapshotSchema,
  createWorldNoteSchema,
} from "./validation";
import { errorResponse, json, type CurrentActor } from "./http";

type Body = Record<string, unknown>;
type Snapshot = Record<string, unknown>;
type TargetType =
  | "PROJECT"
  | "CHAPTER"
  | "SCENE"
  | "CHARACTER"
  | "CHARACTER_NOTE"
  | "WORLD_NOTE"
  | "FORESHADOWING"
  | "MYSTERY"
  | "PLOT_THREAD"
  | "REVISION_TODO"
  | "STORY_STATE_SNAPSHOT";

type TargetConfig = {
  targetType: TargetType;
  delegate: any;
  responseKey: string;
  updateSchema: { partial: () => { parse: (body: Body) => Body } };
  projectIdOf?: (record: Snapshot) => string;
};

const mutationTargets: Record<TargetType, TargetConfig> = {
  PROJECT: { targetType: "PROJECT", delegate: prisma.project, responseKey: "project", updateSchema: createProjectSchema },
  CHAPTER: { targetType: "CHAPTER", delegate: prisma.chapter, responseKey: "chapter", updateSchema: createChapterSchema, projectIdOf: (r) => String(r.projectId) },
  SCENE: { targetType: "SCENE", delegate: prisma.scene, responseKey: "scene", updateSchema: createSceneSchema, projectIdOf: (r) => String(r.projectId) },
  CHARACTER: { targetType: "CHARACTER", delegate: prisma.character, responseKey: "character", updateSchema: createCharacterSchema, projectIdOf: (r) => String(r.projectId) },
  CHARACTER_NOTE: {
    targetType: "CHARACTER_NOTE",
    delegate: prisma.characterNote,
    responseKey: "characterNote",
    updateSchema: createCharacterNoteSchema.omit({ characterId: true, characterName: true }),
    projectIdOf: (r) => String(r.projectId),
  },
  WORLD_NOTE: { targetType: "WORLD_NOTE", delegate: prisma.worldNote, responseKey: "worldNote", updateSchema: createWorldNoteSchema, projectIdOf: (r) => String(r.projectId) },
  FORESHADOWING: { targetType: "FORESHADOWING", delegate: prisma.foreshadowing, responseKey: "foreshadowing", updateSchema: createForeshadowingSchema, projectIdOf: (r) => String(r.projectId) },
  MYSTERY: { targetType: "MYSTERY", delegate: prisma.mystery, responseKey: "mystery", updateSchema: createMysterySchema, projectIdOf: (r) => String(r.projectId) },
  PLOT_THREAD: { targetType: "PLOT_THREAD", delegate: prisma.plotThread, responseKey: "plotThread", updateSchema: createPlotThreadSchema, projectIdOf: (r) => String(r.projectId) },
  REVISION_TODO: { targetType: "REVISION_TODO", delegate: prisma.revisionTodo, responseKey: "revisionTodo", updateSchema: createRevisionTodoSchema, projectIdOf: (r) => String(r.projectId) },
  STORY_STATE_SNAPSHOT: {
    targetType: "STORY_STATE_SNAPSHOT",
    delegate: prisma.storyStateSnapshot,
    responseKey: "storyStateSnapshot",
    updateSchema: createStoryStateSnapshotSchema,
    projectIdOf: (r) => String(r.projectId),
  },
};

function commandId() {
  return `mcp_cmd_${randomUUID()}`;
}

function transactionId() {
  return `mcp_tx_${randomUUID()}`;
}

function snapshot(record: unknown): Snapshot | null {
  if (!record) return null;
  return JSON.parse(JSON.stringify(record)) as Snapshot;
}

function restoreData(record: Snapshot) {
  const data = { ...record };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  return data;
}

async function ownedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, userId, deletedAt: null } });
}

async function requireOwnedProject(projectId: string, actor: CurrentActor) {
  const project = await ownedProject(projectId, actor.userId);
  if (!project) throw new Response("Not found", { status: 404 });
  return project;
}

async function requireOwnedProjectForRollback(projectId: string, actor: CurrentActor) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: actor.userId } });
  if (!project) throw new Response("Not found", { status: 404 });
  return project;
}

async function requireOwnedTarget(config: TargetConfig, id: string, actor: CurrentActor, includeDeleted = false) {
  const record = await config.delegate.findFirst({ where: { id, ...(includeDeleted ? {} : { deletedAt: null }) } });
  if (!record) throw new Response("Not found", { status: 404 });
  const projectId = config.targetType === "PROJECT" ? String(record.id) : config.projectIdOf?.(record);
  if (!projectId) throw new Response("Not found", { status: 404 });
  await requireOwnedProject(projectId, actor);
  return { record, projectId };
}

async function recordMutation(input: {
  actor: CurrentActor;
  projectId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ROLLBACK";
  targetType: TargetType;
  targetId: string;
  beforeSnapshot: Snapshot | null;
  afterSnapshot: Snapshot | null;
  commandId?: string;
  transactionId?: string;
}) {
  return prisma.mutationLog.create({
    data: {
      commandId: input.commandId ?? commandId(),
      transactionId: input.transactionId,
      userId: input.actor.userId,
      apiTokenId: input.actor.apiTokenId,
      projectId: input.projectId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeSnapshot: (input.beforeSnapshot ?? undefined) as any,
      afterSnapshot: (input.afterSnapshot ?? undefined) as any,
    },
  });
}

async function createWithLog(config: TargetConfig, actor: CurrentActor, projectId: string, data: Body, txId?: string) {
  const record = await config.delegate.create({ data });
  const log = await recordMutation({
    actor,
    projectId,
    action: "CREATE",
    targetType: config.targetType,
    targetId: record.id,
    beforeSnapshot: null,
    afterSnapshot: snapshot(record),
    transactionId: txId,
  });
  return { record, commandId: log.commandId };
}

async function updateWithLog(config: TargetConfig, actor: CurrentActor, id: string, data: Body) {
  const { record: before, projectId } = await requireOwnedTarget(config, id, actor);
  const record = await config.delegate.update({ where: { id }, data });
  const log = await recordMutation({
    actor,
    projectId,
    action: "UPDATE",
    targetType: config.targetType,
    targetId: id,
    beforeSnapshot: snapshot(before),
    afterSnapshot: snapshot(record),
  });
  return { record, commandId: log.commandId };
}

async function softDeleteWithLog(config: TargetConfig, actor: CurrentActor, id: string, reason?: string) {
  const { record: before, projectId } = await requireOwnedTarget(config, id, actor);
  const record = await config.delegate.update({ where: { id }, data: { deletedAt: new Date() } });
  const log = await recordMutation({
    actor,
    projectId,
    action: "DELETE",
    targetType: config.targetType,
    targetId: id,
    beforeSnapshot: snapshot(before),
    afterSnapshot: snapshot({ ...record, deleteReason: reason }),
  });
  return { record, commandId: log.commandId };
}

function handleError(error: unknown) {
  if (error instanceof PlanLimitError) {
    return errorResponse("PLAN_LIMIT_EXCEEDED", error.message, 403, { current: error.current, limit: error.limit });
  }
  if (error instanceof Response) return error;
  if (error && typeof error === "object" && "issues" in error) {
    return errorResponse("VALIDATION_ERROR", "Request body is invalid.", 400, { issues: (error as { issues: unknown }).issues });
  }
  return errorResponse("INTERNAL_ERROR", "Unexpected server error.", 500);
}

async function exportableProject(projectId: string) {
  return prisma.project.findFirstOrThrow({
    where: { id: projectId, deletedAt: null },
    include: {
      chapters: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      scenes: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      characters: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: { notes: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } } },
      },
      worldNotes: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
      foreshadowings: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
      mysteries: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
      plotThreads: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
      revisionTodos: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
      storyStateSnapshots: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
}

/**
 * Builds response headers that force a file download with a UTF-8 filename.
 * Uses RFC 5987 `filename*` plus an ASCII `filename` fallback.
 */
function downloadHeaders(contentType: string, filename: string) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "export";
  return {
    "content-type": contentType,
    "content-disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
}

async function ensureJsonExportAllowed(userId: string) {
  const plan = await getPlan(userId);
  if (plan === "FREE") {
    throw new PlanLimitError("Plus plan is required to export JSON.", 0, 1);
  }
}

async function handleIndividualRoute(method: string, path: string[], actor: CurrentActor, body: Body) {
  const routeMap: Record<string, TargetConfig> = {
    chapters: mutationTargets.CHAPTER,
    scenes: mutationTargets.SCENE,
    characters: mutationTargets.CHARACTER,
    "character-notes": mutationTargets.CHARACTER_NOTE,
    "world-notes": mutationTargets.WORLD_NOTE,
    foreshadowings: mutationTargets.FORESHADOWING,
    mysteries: mutationTargets.MYSTERY,
    "plot-threads": mutationTargets.PLOT_THREAD,
    "revision-todos": mutationTargets.REVISION_TODO,
    "story-state-snapshots": mutationTargets.STORY_STATE_SNAPSHOT,
  };
  const config = routeMap[path[0]];
  const id = path[1];
  if (!config || !id || path.length !== 2) return null;

  if (method === "GET" && (config.targetType === "SCENE" || config.targetType === "CHARACTER")) {
    const { record } = await requireOwnedTarget(config, id, actor);
    return json({ [config.responseKey]: record });
  }
  if (method === "PATCH") {
    const input = config.updateSchema.partial().parse(body);
    const { record, commandId: undoToken } = await updateWithLog(config, actor, id, input);
    return json({ [config.responseKey]: record, commandId: undoToken });
  }
  if (method === "DELETE") {
    const { commandId: undoToken } = await softDeleteWithLog(config, actor, id);
    return json({ ok: true, commandId: undoToken });
  }
  return null;
}

export async function handleWebApi(method: string, path: string[], actor: CurrentActor, body: Body) {
  try {
    const individual = await handleIndividualRoute(method, path, actor, body);
    if (individual) return individual;

    if (path[0] === "characters" && path[1] && path[2] === "notes") {
      const { record: character, projectId } = await requireOwnedTarget(mutationTargets.CHARACTER, path[1], actor);
      if (method === "GET") {
        return json({ characterNotes: await prisma.characterNote.findMany({ where: { characterId: character.id, deletedAt: null }, orderBy: { updatedAt: "desc" } }) });
      }
      if (method === "POST") {
        const input = createCharacterNoteSchema.omit({ characterId: true, characterName: true }).parse(body);
        const { record, commandId: undoToken } = await createWithLog(mutationTargets.CHARACTER_NOTE, actor, projectId, { ...input, projectId, characterId: character.id });
        return json({ characterNote: record, commandId: undoToken }, { status: 201 });
      }
    }

    if (path[0] === "projects" && path.length === 1) {
      if (method === "GET") {
        return json({ projects: await prisma.project.findMany({ where: { userId: actor.userId, deletedAt: null }, orderBy: { updatedAt: "desc" } }) });
      }
      if (method === "POST") {
        await assertCanCreateProject(actor.userId);
        const input = createProjectSchema.parse(body);
        const txId = transactionId();
        const project = await prisma.project.create({ data: { ...input, userId: actor.userId } });
        const log = await recordMutation({
          actor,
          projectId: project.id,
          action: "CREATE",
          targetType: "PROJECT",
          targetId: project.id,
          beforeSnapshot: null,
          afterSnapshot: snapshot(project),
          transactionId: txId,
        });
        const state = await prisma.storyStateSnapshot.create({ data: { projectId: project.id, summary: input.premise ?? `${input.title} initial state` } });
        await recordMutation({
          actor,
          projectId: project.id,
          action: "CREATE",
          targetType: "STORY_STATE_SNAPSHOT",
          targetId: state.id,
          beforeSnapshot: null,
          afterSnapshot: snapshot(state),
          transactionId: txId,
        });
        return json({ project, commandId: log.commandId, transactionId: txId }, { status: 201 });
      }
    }

    if (path[0] === "projects" && path[1]) {
      const projectId = path[1];
      if (path.length === 2) {
        await requireOwnedProject(projectId, actor);
        if (method === "GET") return json({ project: await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } }) });
        if (method === "PATCH") {
          const input = createProjectSchema.partial().parse(body);
          const { record, commandId: undoToken } = await updateWithLog(mutationTargets.PROJECT, actor, projectId, input);
          return json({ project: record, commandId: undoToken });
        }
        if (method === "DELETE") {
          const { commandId: undoToken } = await softDeleteWithLog(mutationTargets.PROJECT, actor, projectId);
          return json({ ok: true, commandId: undoToken });
        }
      }

      await requireOwnedProject(projectId, actor);
      const collection = path[2];
      if (collection === "chapters") {
        if (method === "GET") return json({ chapters: await prisma.chapter.findMany({ where: { projectId, deletedAt: null }, orderBy: { order: "asc" } }) });
        if (method === "POST") {
          const input = createChapterSchema.parse(body);
          const order = input.order ?? await prisma.chapter.count({ where: { projectId, deletedAt: null } });
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.CHAPTER, actor, projectId, { ...input, order, projectId });
          return json({ chapter: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "scenes") {
        if (method === "GET") return json({ scenes: await prisma.scene.findMany({ where: { projectId, deletedAt: null }, orderBy: { order: "asc" } }) });
        if (method === "POST") {
          const input = createSceneSchema.parse(body);
          await assertCanAddScene(projectId, input.body.length);
          const order = input.order ?? await prisma.scene.count({ where: { projectId, deletedAt: null } });
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.SCENE, actor, projectId, { ...input, order, projectId });
          return json({ scene: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "characters") {
        if (method === "GET") return json({ characters: await prisma.character.findMany({ where: { projectId, deletedAt: null }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "charactersPerProject");
          const input = createCharacterSchema.parse(body);
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.CHARACTER, actor, projectId, { ...input, projectId });
          return json({ character: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "world-notes") {
        if (method === "GET") return json({ worldNotes: await prisma.worldNote.findMany({ where: { projectId, deletedAt: null }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "worldNotesPerProject");
          const input = createWorldNoteSchema.parse(body);
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.WORLD_NOTE, actor, projectId, { ...input, projectId });
          return json({ worldNote: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "foreshadowings") {
        if (method === "GET") return json({ foreshadowings: await prisma.foreshadowing.findMany({ where: { projectId, deletedAt: null }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "foreshadowingsPerProject");
          const input = createForeshadowingSchema.parse(body);
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.FORESHADOWING, actor, projectId, { ...input, projectId });
          return json({ foreshadowing: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "mysteries") {
        if (method === "GET") return json({ mysteries: await prisma.mystery.findMany({ where: { projectId, deletedAt: null }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "mysteriesPerProject");
          const input = createMysterySchema.parse(body);
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.MYSTERY, actor, projectId, { ...input, projectId });
          return json({ mystery: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "plot-threads") {
        if (method === "GET") return json({ plotThreads: await prisma.plotThread.findMany({ where: { projectId, deletedAt: null }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "plotThreadsPerProject");
          const input = createPlotThreadSchema.parse(body);
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.PLOT_THREAD, actor, projectId, { ...input, projectId });
          return json({ plotThread: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "revision-todos") {
        if (method === "GET") return json({ revisionTodos: await prisma.revisionTodo.findMany({ where: { projectId, deletedAt: null }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "revisionTodosPerProject");
          const input = createRevisionTodoSchema.parse(body);
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.REVISION_TODO, actor, projectId, { ...input, projectId });
          return json({ revisionTodo: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "story-state-snapshots") {
        if (method === "GET") return json({ storyStateSnapshots: await prisma.storyStateSnapshot.findMany({ where: { projectId, deletedAt: null }, orderBy: { createdAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "storySnapshotsPerProject");
          const input = createStoryStateSnapshotSchema.parse(body);
          const { record, commandId: undoToken } = await createWithLog(mutationTargets.STORY_STATE_SNAPSHOT, actor, projectId, { ...input, projectId });
          return json({ storyStateSnapshot: record, commandId: undoToken }, { status: 201 });
        }
      }
      if (collection === "reading-progress") {
        if (method === "GET") {
          return json({
            readingProgress: await prisma.readingProgress.findUnique({
              where: { userId_projectId: { userId: actor.userId, projectId } },
            }),
          });
        }
        if (method === "POST" || method === "PATCH") {
          const sceneId = typeof body.sceneId === "string" && body.sceneId ? body.sceneId : null;
          const rawRatio = typeof body.scrollRatio === "number" ? body.scrollRatio : 0;
          const scrollRatio = Number.isFinite(rawRatio) ? Math.min(1, Math.max(0, rawRatio)) : 0;
          const readingProgress = await prisma.readingProgress.upsert({
            where: { userId_projectId: { userId: actor.userId, projectId } },
            create: { userId: actor.userId, projectId, sceneId, scrollRatio },
            update: { sceneId, scrollRatio },
          });
          return json({ readingProgress });
        }
      }
      if (collection === "story-state" && path[3] === "latest" && method === "GET") {
        return json({ latestStoryState: await prisma.storyStateSnapshot.findFirst({ where: { projectId, deletedAt: null }, orderBy: { createdAt: "desc" } }) });
      }
      if (collection === "export") {
        const project = await exportableProject(projectId);
        const safeTitle = project.title.trim() || "export";
        if (path[3] === "markdown") {
          return new Response(renderMarkdown(project), { headers: downloadHeaders("text/markdown; charset=utf-8", `${safeTitle}.md`) });
        }
        if (path[3] === "text") {
          const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { locale: true } });
          const locale = user?.locale === "en" ? "en" : "ja";
          return new Response(renderPlainText(project, locale), { headers: downloadHeaders("text/plain; charset=utf-8", `${safeTitle}.txt`) });
        }
        if (path[3] === "json") {
          await ensureJsonExportAllowed(actor.userId);
          return json(project);
        }
      }
    }

    return errorResponse("NOT_FOUND", "Route not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}

async function rollbackOne(log: any, actor: CurrentActor, force: boolean) {
  const config = mutationTargets[log.targetType as TargetType];
  if (!config || log.rolledBackAt || log.action === "ROLLBACK") {
    throw new Response(JSON.stringify({ error: "ROLLBACK_NOT_ALLOWED", message: "Command cannot be rolled back." }), { status: 409 });
  }
  const laterMutation = await prisma.mutationLog.findFirst({
    where: {
      targetType: log.targetType,
      targetId: log.targetId,
      createdAt: { gt: log.createdAt },
      action: { not: "ROLLBACK" },
      rolledBackAt: null,
    },
    orderBy: { createdAt: "asc" },
  });
  if (laterMutation && !force) {
    return { conflict: true, commandId: log.commandId, conflictingCommandId: laterMutation.commandId };
  }

  const before = await config.delegate.findFirst({ where: { id: log.targetId } });
  let after = null;
  if (log.action === "CREATE") {
    after = await config.delegate.update({ where: { id: log.targetId }, data: { deletedAt: new Date() } });
  } else if (log.action === "DELETE") {
    after = await config.delegate.update({ where: { id: log.targetId }, data: { deletedAt: null } });
  } else if (log.action === "UPDATE") {
    after = await config.delegate.update({ where: { id: log.targetId }, data: restoreData(log.beforeSnapshot as Snapshot) });
  }
  await prisma.mutationLog.update({ where: { id: log.id }, data: { rolledBackAt: new Date() } });
  const rollbackLog = await recordMutation({
    actor,
    projectId: log.projectId,
    action: "ROLLBACK",
    targetType: log.targetType,
    targetId: log.targetId,
    beforeSnapshot: snapshot(before),
    afterSnapshot: snapshot(after),
  });
  return { conflict: false, commandId: log.commandId, rollbackCommandId: rollbackLog.commandId, targetType: log.targetType, targetId: log.targetId };
}

async function rollbackCommand(actor: CurrentActor, body: Body) {
  const projectId = String(body.projectId ?? "");
  if (!projectId) return errorResponse("VALIDATION_ERROR", "projectId is required.");
  await requireOwnedProjectForRollback(projectId, actor);
  const force = body.force === true;
  const requestedTransactionId = typeof body.transactionId === "string" ? body.transactionId : "";
  const requestedCommandId = typeof body.commandId === "string" ? body.commandId : "";

  let logs: any[] = [];
  if (requestedTransactionId) {
    logs = await prisma.mutationLog.findMany({
      where: { userId: actor.userId, projectId, transactionId: requestedTransactionId, rolledBackAt: null, action: { not: "ROLLBACK" } },
      orderBy: { createdAt: "desc" },
    });
  } else if (requestedCommandId) {
    const log = await prisma.mutationLog.findFirst({
      where: { userId: actor.userId, projectId, commandId: requestedCommandId, rolledBackAt: null, action: { not: "ROLLBACK" } },
    });
    if (log) logs = [log];
  } else {
    const log = await prisma.mutationLog.findFirst({
      where: { userId: actor.userId, projectId, rolledBackAt: null, action: { not: "ROLLBACK" } },
      orderBy: { createdAt: "desc" },
    });
    if (log) logs = [log];
  }
  if (logs.length === 0) return errorResponse("NOT_FOUND", "Rollback target was not found.", 404);

  const results = [];
  for (const log of logs) {
    const result = await rollbackOne(log, actor, force);
    if (result.conflict) {
      return errorResponse("ROLLBACK_CONFLICT", "A later command has changed the same data. Retry with force: true to override.", 409, result);
    }
    results.push(result);
  }

  return json({
    ok: true,
    rolledBackCommandIds: results.map((item) => item.commandId),
    rolledBackTransactionId: requestedTransactionId || null,
    result: results.at(-1) ?? null,
  });
}

function mcpHelp(locale: string | null | undefined) {
  if (locale === "en") {
    return {
      title: "StoryCanon MCP API — Getting Started",
      overview:
        "This API lets ChatGPT read and write your private StoryCanon works (scenes, characters, world notes, foreshadowing, plot threads, TODOs, and the latest story state). Every request needs the Bearer token you issue at /settings.",
      firstTimeSteps: [
        "1. Issue an API token in StoryCanon under Settings, and set it as the Bearer token for this action.",
        "2. Call listPrivateProjects to see your works and their projectId (create one with createPrivateProject if you have none).",
        "3. Before writing, call getPrivateProjectContext with the projectId to load the latest story state, characters, active plot threads, and unresolved foreshadowing.",
        "4. Generate a scene, then save it with saveGeneratedScene.",
        "5. After writing, keep the canon in sync: saveStoryStateSnapshot for the latest story state, and saveForeshadowing / savePlotThread / saveRevisionTodo as needed.",
      ],
      typicalLoop:
        "getPrivateProjectContext → (generate) → saveGeneratedScene → saveStoryStateSnapshot → repeat. Made a mistake? undoLastCommand reverts your most recent change.",
      operations: {
        projects: {
          listPrivateProjects: "List your works with their projectId.",
          createPrivateProject: "Create a new work (only title is required).",
          updatePrivateProject: "Update a work's title or settings (genre, premise, tone, etc.).",
          consultTitle: "Get context and guidance for brainstorming title ideas.",
        },
        context: {
          getPrivateProjectContext: "Load the current state: summary, characters, foreshadowing, active plot threads.",
          getNextGenerationContext: "Same content as getPrivateProjectContext, for the next generation step.",
        },
        writing: {
          saveGeneratedScene: "Save generated body text as a scene (projectId and body required).",
          saveCharacter: "Create or update a character.",
          saveCharacterNote: "Save a character note (unknown character names are auto-created).",
          saveWorldNote: "Save a world-building note.",
          saveForeshadowing: "Save a piece of foreshadowing.",
          saveMystery: "Save a mystery (central/arc/episode/scene scope).",
          savePlotThread: "Save an active plot thread.",
          saveRevisionTodo: "Save a revision TODO.",
          saveStoryStateSnapshot: "Save the latest story state (summary required).",
        },
        maintenance: {
          deleteProjectData: "Soft-delete data under a work (never a hard delete).",
          undoLastCommand: "Undo the most recent operation.",
          rollbackCommand: "Undo a specific save/update/delete by its commandId or transactionId.",
        },
      },
      tips: [
        "projectId is required for every operation except listPrivateProjects, createPrivateProject, and help.",
        "Most write operations return a commandId — pass it to rollbackCommand to undo just that change.",
        "Deletes are logical (soft) deletes, so they can be undone.",
      ],
    };
  }
  return {
    title: "StoryCanon MCP API — はじめかた",
    overview:
      "この API を使うと、ChatGPT から StoryCanon の非公開作品(シーン本文・キャラクター・世界観・伏線・プロット・TODO・物語の最新状態)を読み書きできます。各リクエストには /settings で発行した Bearer トークンが必要です。",
    firstTimeSteps: [
      "1. StoryCanon の設定画面で API トークンを発行し、このアクションの Bearer トークンに設定する。",
      "2. listPrivateProjects を呼んで作品一覧と projectId を確認する(作品が無ければ createPrivateProject で作成)。",
      "3. 執筆前に getPrivateProjectContext を projectId 付きで呼び、物語の最新状態・キャラクター・進行中プロット・未回収の伏線を読み込む。",
      "4. シーンを生成したら saveGeneratedScene で保存する。",
      "5. 執筆後は設定を最新化する: saveStoryStateSnapshot で物語の最新状態を保存し、必要に応じて saveForeshadowing / savePlotThread / saveRevisionTodo を使う。",
    ],
    typicalLoop:
      "getPrivateProjectContext →(生成)→ saveGeneratedScene → saveStoryStateSnapshot を繰り返します。間違えたときは undoLastCommand で直前の操作を取り消せます。",
    operations: {
      projects: {
        listPrivateProjects: "作品一覧と projectId を取得する。",
        createPrivateProject: "新しい作品を作成する(必須は title のみ)。",
        updatePrivateProject: "作品のタイトルや設定(ジャンル・前提・トーン等)を更新する。",
        consultTitle: "タイトル案を相談するためのコンテキストと指針を取得する。",
      },
      context: {
        getPrivateProjectContext: "現在状態(要約・キャラ・伏線・進行中プロット)を取得する。",
        getNextGenerationContext: "getPrivateProjectContext と同じ内容(次回生成用)。",
      },
      writing: {
        saveGeneratedScene: "生成した本文をシーンとして保存する(projectId と body が必須)。",
        saveCharacter: "キャラクターを新規登録または更新する。",
        saveCharacterNote: "キャラクターメモを保存する(存在しないキャラ名は自動作成)。",
        saveWorldNote: "世界観メモを保存する。",
        saveForeshadowing: "伏線を保存する。",
        saveMystery: "ミステリー(謎)を保存する。スコープは central/arc/episode/scene。",
        savePlotThread: "進行中プロットを保存する。",
        saveRevisionTodo: "修正TODOを保存する。",
        saveStoryStateSnapshot: "物語の最新状態を保存する(summary が必須)。",
      },
      maintenance: {
        deleteProjectData: "作品配下のデータを論理削除する(物理削除は行わない)。",
        undoLastCommand: "直前の操作を取り消す。",
        rollbackCommand: "commandId または transactionId を指定して特定の保存・更新・削除を取り消す。",
      },
    },
    tips: [
      "projectId は listPrivateProjects・createPrivateProject・help 以外のすべての操作で必須です。",
      "多くの書き込み操作は commandId を返します。rollbackCommand に渡すとその変更だけを取り消せます。",
      "削除は論理削除なので、後から取り消せます。",
    ],
  };
}

export async function handleMcpApi(action: string, actor: CurrentActor, body: Body) {
  try {
    if (action === "help") {
      const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { locale: true } });
      return json({ help: mcpHelp(user?.locale) });
    }
    if (action === "list-private-projects") {
      const projects = await prisma.project.findMany({
        where: { userId: actor.userId, deletedAt: null },
        select: { id: true, title: true, genre: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });
      return json({ projects });
    }
    if (action === "create-private-project") return handleWebApi("POST", ["projects"], actor, body);

    const projectId = String(body.projectId ?? "");
    if (!projectId) return errorResponse("VALIDATION_ERROR", "projectId is required.");
    if (action === "rollback-command" || action === "undo-last-command") return rollbackCommand(actor, action === "undo-last-command" ? { projectId, force: body.force } : body);
    await requireOwnedProject(projectId, actor);

    if (action === "update-private-project") return handleWebApi("PATCH", ["projects", projectId], actor, body);
    if (action === "consult-title") {
      const project = await prisma.project.findFirstOrThrow({
        where: { id: projectId, deletedAt: null },
        include: {
          characters: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 8, select: { name: true, role: true, goal: true } },
          worldNotes: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5, select: { title: true, category: true } },
          storyStateSnapshots: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { summary: true } },
        },
      });
      const direction = (typeof body.direction === "string" ? body.direction : "").trim().slice(0, 200);
      const rawCount = Number(body.count);
      const count = Number.isFinite(rawCount) ? Math.min(12, Math.max(3, Math.trunc(rawCount))) : 6;
      const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { locale: true } });
      const guidance =
        user?.locale === "en"
          ? `Based on the project information above, propose ${count} appealing title candidates. ` +
            "Match the genre, tone, target audience, and overall mood, and vary the approach for each (e.g. literal / symbolic / question / character-name). " +
            "For each candidate, add a one-line rationale (why it works) and its appeal to the reader. " +
            (direction ? `In particular, reflect the user's requested direction: "${direction}". ` : "") +
            "Once a favourite is chosen, update it with the update-private-project tool's title field."
          : `上記の作品情報を踏まえ、魅力的なタイトル案を${count}個提案してください。` +
            "ジャンル・トーン・想定読者・作品の雰囲気に合わせ、それぞれ方向性（例: 直球型／象徴型／問いかけ型／キャラ名型）を変えてバリエーションを出してください。" +
            "各案には短い狙い（なぜ効果的か）と読者への訴求ポイントを1行添えてください。" +
            (direction ? `特にユーザーの希望する方向性「${direction}」を反映してください。` : "") +
            "気に入った案が決まったら update-private-project ツールで title を更新できます。";
      return json({
        currentTitle: project.title,
        context: {
          genre: project.genre,
          premise: project.premise,
          tone: project.tone,
          targetAudience: project.targetAudience,
          writingStyle: project.writingStyle,
        },
        characters: project.characters,
        worldNoteHighlights: project.worldNotes,
        latestStoryState: project.storyStateSnapshots[0]?.summary ?? null,
        userDirection: direction || null,
        guidance,
      });
    }

    if (action === "get-private-project-context" || action === "get-next-generation-context") {
      const project = await prisma.project.findFirstOrThrow({
        where: { id: projectId, deletedAt: null },
        include: {
          characters: { where: { deletedAt: null } },
          plotThreads: { where: { deletedAt: null, status: { in: ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD"] } } },
          foreshadowings: { where: { deletedAt: null, status: { in: ["UNPLANTED", "PLANTED", "IN_PROGRESS"] } } },
          mysteries: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
          storyStateSnapshots: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      return json({
        project: { id: project.id, title: project.title, genre: project.genre, premise: project.premise, tone: project.tone },
        latestStoryState: project.storyStateSnapshots[0] ?? null,
        characters: project.characters,
        activePlotThreads: project.plotThreads,
        unresolvedForeshadowings: project.foreshadowings,
        mysteries: project.mysteries,
      });
    }
    if (action === "save-generated-scene") {
      const input = createSceneSchema.parse({
        chapterId: body.chapterId,
        title: body.sceneTitle ?? body.title,
        body: body.body,
        summary: body.summary,
        occurredEvents: body.occurredEvents,
        generationPrompt: body.generationPrompt,
        createdBy: "CHATGPT",
      });
      await assertCanAddScene(projectId, input.body.length);
      const txId = transactionId();
      const chapterTitle = String(body.chapterTitle ?? "");
      let chapterId = input.chapterId;
      if (!chapterId && chapterTitle) {
        const existing = await prisma.chapter.findFirst({ where: { projectId, title: chapterTitle, deletedAt: null } });
        if (existing) {
          chapterId = existing.id;
        } else {
          const order = await prisma.chapter.count({ where: { projectId, deletedAt: null } });
          const { record: chapter } = await createWithLog(mutationTargets.CHAPTER, actor, projectId, { projectId, title: chapterTitle, order }, txId);
          chapterId = chapter.id;
        }
      }
      const order = input.order ?? await prisma.scene.count({ where: { projectId, deletedAt: null } });
      const { record: scene, commandId: sceneCommandId } = await createWithLog(mutationTargets.SCENE, actor, projectId, { ...input, chapterId, order, projectId }, txId);
      return json({ scene, commandId: sceneCommandId, transactionId: txId }, { status: 201 });
    }
    if (action === "save-character") {
      const characterId = typeof body.characterId === "string" ? body.characterId.trim() : "";

      // Updating by id: name is optional so only the provided fields change (no forced rename).
      if (characterId) {
        const existing = await prisma.character.findFirst({ where: { id: characterId, projectId, deletedAt: null }, select: { id: true } });
        if (!existing) return errorResponse("NOT_FOUND", "Character not found.", 404);
        const input = createCharacterSchema.partial().parse(body);
        const { record: character, commandId: undoToken } = await updateWithLog(mutationTargets.CHARACTER, actor, existing.id, input);
        return json({ character, commandId: undoToken, created: false });
      }

      // Creating or upserting by name: name is required.
      const input = createCharacterSchema.parse(body);
      const existing = await prisma.character.findFirst({ where: { projectId, name: input.name, deletedAt: null }, select: { id: true } });
      if (existing) {
        const { record: character, commandId: undoToken } = await updateWithLog(mutationTargets.CHARACTER, actor, existing.id, input);
        return json({ character, commandId: undoToken, created: false });
      }

      await assertCountLimit(projectId, "charactersPerProject");
      const { record: character, commandId: undoToken } = await createWithLog(mutationTargets.CHARACTER, actor, projectId, { ...input, projectId });
      return json({ character, commandId: undoToken, created: true }, { status: 201 });
    }
    if (action === "save-character-note") {
      const input = createCharacterNoteSchema.parse(body);
      const txId = transactionId();
      let character = input.characterId ? await prisma.character.findFirst({ where: { id: input.characterId, projectId, deletedAt: null } }) : null;
      if (!character) {
        const name = input.characterName ?? "Unknown";
        character = await prisma.character.findFirst({ where: { projectId, name, deletedAt: null } });
        if (!character) {
          await assertCountLimit(projectId, "charactersPerProject");
          const created = await createWithLog(mutationTargets.CHARACTER, actor, projectId, { projectId, name }, txId);
          character = created.record;
        }
      }
      if (!character) return errorResponse("NOT_FOUND", "Character not found.", 404);
      const { record: characterNote, commandId: noteCommandId } = await createWithLog(mutationTargets.CHARACTER_NOTE, actor, projectId, {
        projectId,
        characterId: character.id,
        title: input.title,
        body: input.body,
        category: input.category,
        importance: input.importance,
        relatedSceneId: input.relatedSceneId,
      }, txId);
      return json({ characterNote, commandId: noteCommandId, transactionId: txId }, { status: 201 });
    }
    const actionMap = {
      "save-world-note": ["world-notes"],
      "save-foreshadowing": ["foreshadowings"],
      "save-mystery": ["mysteries"],
      "save-plot-thread": ["plot-threads"],
      "save-revision-todo": ["revision-todos"],
      "save-story-state-snapshot": ["story-state-snapshots"],
    } as const;
    if (action in actionMap) return handleWebApi("POST", ["projects", projectId, actionMap[action as keyof typeof actionMap][0]], actor, body);
    if (action === "delete-project-data") {
      const targetType = String(body.targetType ?? "") as TargetType;
      const config = mutationTargets[targetType];
      if (!config) return errorResponse("VALIDATION_ERROR", "targetType is invalid.");
      const targetId = targetType === "PROJECT" ? String(body.targetId ?? projectId) : String(body.targetId ?? "");
      if (!targetId) return errorResponse("VALIDATION_ERROR", "targetId is required.");
      const { record, commandId: undoToken } = await softDeleteWithLog(config, actor, targetId, typeof body.reason === "string" ? body.reason : undefined);
      return json({ ok: true, deleted: { targetType, targetId, deletedAt: record.deletedAt }, undoToken });
    }
    return errorResponse("NOT_FOUND", "MCP action not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}
