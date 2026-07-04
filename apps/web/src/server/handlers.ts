import { prisma } from "@/lib/prisma";
import { PlanLimitError, assertCanAddScene, assertCanCreateProject, assertCountLimit } from "./plan";
import { renderMarkdown } from "./export";
import {
  createChapterSchema,
  createCharacterNoteSchema,
  createCharacterSchema,
  createForeshadowingSchema,
  createPlotThreadSchema,
  createProjectSchema,
  createRevisionTodoSchema,
  createSceneSchema,
  createStoryStateSnapshotSchema,
  createWorldNoteSchema,
} from "./validation";
import { errorResponse, json, type CurrentActor } from "./http";

type Body = Record<string, unknown>;

async function ownedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, userId } });
}

async function requireOwnedProject(projectId: string, actor: CurrentActor) {
  const project = await ownedProject(projectId, actor.userId);
  if (!project) throw new Response("Not found", { status: 404 });
  return project;
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

export async function handleWebApi(method: string, path: string[], actor: CurrentActor, body: Body) {
  try {
    if (path[0] === "projects" && path.length === 1) {
      if (method === "GET") {
        return json({ projects: await prisma.project.findMany({ where: { userId: actor.userId }, orderBy: { updatedAt: "desc" } }) });
      }
      if (method === "POST") {
        await assertCanCreateProject(actor.userId);
        const input = createProjectSchema.parse(body);
        const project = await prisma.project.create({ data: { ...input, userId: actor.userId } });
        await prisma.storyStateSnapshot.create({ data: { projectId: project.id, summary: input.premise ?? `${input.title} の初期状態` } });
        return json({ project }, { status: 201 });
      }
    }

    if (path[0] === "projects" && path[1]) {
      const projectId = path[1];
      if (path.length === 2) {
        await requireOwnedProject(projectId, actor);
        if (method === "GET") {
          const project = await prisma.project.findUnique({ where: { id: projectId } });
          return json({ project });
        }
        if (method === "PATCH") {
          const input = createProjectSchema.partial().parse(body);
          return json({ project: await prisma.project.update({ where: { id: projectId }, data: input }) });
        }
        if (method === "DELETE") {
          await prisma.project.delete({ where: { id: projectId } });
          return json({ ok: true });
        }
      }

      await requireOwnedProject(projectId, actor);
      const collection = path[2];
      if (collection === "chapters") {
        if (method === "GET") return json({ chapters: await prisma.chapter.findMany({ where: { projectId }, orderBy: { order: "asc" } }) });
        if (method === "POST") {
          const input = createChapterSchema.parse(body);
          const order = input.order ?? await prisma.chapter.count({ where: { projectId } });
          return json({ chapter: await prisma.chapter.create({ data: { ...input, order, projectId } }) }, { status: 201 });
        }
      }
      if (collection === "scenes") {
        if (method === "GET") return json({ scenes: await prisma.scene.findMany({ where: { projectId }, orderBy: { order: "asc" } }) });
        if (method === "POST") {
          const input = createSceneSchema.parse(body);
          await assertCanAddScene(projectId, input.body.length);
          const order = input.order ?? await prisma.scene.count({ where: { projectId } });
          return json({ scene: await prisma.scene.create({ data: { ...input, order, projectId } }) }, { status: 201 });
        }
      }
      if (collection === "characters") {
        if (method === "GET") return json({ characters: await prisma.character.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "charactersPerProject");
          const input = createCharacterSchema.parse(body);
          return json({ character: await prisma.character.create({ data: { ...input, projectId } }) }, { status: 201 });
        }
      }
      if (collection === "world-notes") {
        if (method === "GET") return json({ worldNotes: await prisma.worldNote.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "worldNotesPerProject");
          const input = createWorldNoteSchema.parse(body);
          return json({ worldNote: await prisma.worldNote.create({ data: { ...input, projectId } }) }, { status: 201 });
        }
      }
      if (collection === "foreshadowings") {
        if (method === "GET") return json({ foreshadowings: await prisma.foreshadowing.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "foreshadowingsPerProject");
          const input = createForeshadowingSchema.parse(body);
          return json({ foreshadowing: await prisma.foreshadowing.create({ data: { ...input, projectId } }) }, { status: 201 });
        }
      }
      if (collection === "plot-threads") {
        if (method === "GET") return json({ plotThreads: await prisma.plotThread.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "plotThreadsPerProject");
          const input = createPlotThreadSchema.parse(body);
          return json({ plotThread: await prisma.plotThread.create({ data: { ...input, projectId } }) }, { status: 201 });
        }
      }
      if (collection === "revision-todos") {
        if (method === "GET") return json({ revisionTodos: await prisma.revisionTodo.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "revisionTodosPerProject");
          const input = createRevisionTodoSchema.parse(body);
          return json({ revisionTodo: await prisma.revisionTodo.create({ data: { ...input, projectId } }) }, { status: 201 });
        }
      }
      if (collection === "story-state-snapshots") {
        if (method === "GET") return json({ storyStateSnapshots: await prisma.storyStateSnapshot.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }) });
        if (method === "POST") {
          await assertCountLimit(projectId, "storySnapshotsPerProject");
          const input = createStoryStateSnapshotSchema.parse(body);
          return json({ storyStateSnapshot: await prisma.storyStateSnapshot.create({ data: { ...input, projectId } }) }, { status: 201 });
        }
      }
      if (collection === "story-state" && path[3] === "latest" && method === "GET") {
        return json({ latestStoryState: await prisma.storyStateSnapshot.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } }) });
      }
      if (collection === "export") {
        const project = await prisma.project.findUniqueOrThrow({
          where: { id: projectId },
          include: {
            chapters: true,
            scenes: true,
            characters: true,
            worldNotes: true,
            foreshadowings: true,
            plotThreads: true,
            revisionTodos: true,
            storyStateSnapshots: { orderBy: { createdAt: "desc" } },
          },
        });
        if (path[3] === "markdown") return new Response(renderMarkdown(project), { headers: { "content-type": "text/markdown; charset=utf-8" } });
        if (path[3] === "json") return json(project);
      }
    }

    return errorResponse("NOT_FOUND", "Route not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleMcpApi(action: string, actor: CurrentActor, body: Body) {
  try {
    if (action === "list-private-projects") {
      const projects = await prisma.project.findMany({
        where: { userId: actor.userId },
        select: { id: true, title: true, genre: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });
      return json({ projects });
    }
    if (action === "create-private-project") {
      return handleWebApi("POST", ["projects"], actor, body);
    }
    const projectId = String(body.projectId ?? "");
    if (!projectId) return errorResponse("VALIDATION_ERROR", "projectId is required.");
    await requireOwnedProject(projectId, actor);

    if (action === "get-private-project-context" || action === "get-next-generation-context") {
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        include: {
          characters: true,
          plotThreads: { where: { status: { in: ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD"] } } },
          foreshadowings: { where: { status: { in: ["UNPLANTED", "PLANTED", "IN_PROGRESS"] } } },
          storyStateSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      return json({
        project: {
          id: project.id,
          title: project.title,
          genre: project.genre,
          premise: project.premise,
          tone: project.tone,
        },
        latestStoryState: project.storyStateSnapshots[0] ?? null,
        characters: project.characters,
        activePlotThreads: project.plotThreads,
        unresolvedForeshadowings: project.foreshadowings,
      });
    }
    if (action === "save-generated-scene") {
      const chapterTitle = String(body.chapterTitle ?? "");
      let chapterId = typeof body.chapterId === "string" ? body.chapterId : undefined;
      if (!chapterId && chapterTitle) {
        const existing = await prisma.chapter.findFirst({ where: { projectId, title: chapterTitle } });
        chapterId = existing?.id ?? (await prisma.chapter.create({
          data: { projectId, title: chapterTitle, order: await prisma.chapter.count({ where: { projectId } }) },
        })).id;
      }
      return handleWebApi("POST", ["projects", projectId, "scenes"], actor, {
        chapterId,
        title: body.sceneTitle ?? body.title,
        body: body.body,
        summary: body.summary,
        occurredEvents: body.occurredEvents,
        generationPrompt: body.generationPrompt,
        createdBy: "CHATGPT",
      });
    }
    if (action === "save-character-note") {
      const input = createCharacterNoteSchema.parse(body);
      let character = input.characterId ? await prisma.character.findFirst({ where: { id: input.characterId, projectId } }) : null;
      if (!character) {
        const name = input.characterName ?? "Unknown";
        character = await prisma.character.findUnique({ where: { projectId_name: { projectId, name } } });
        if (!character) {
          await assertCountLimit(projectId, "charactersPerProject");
          character = await prisma.character.create({ data: { projectId, name } });
        }
      }
      if (!character) return errorResponse("NOT_FOUND", "Character not found.", 404);
      return json({
        characterNote: await prisma.characterNote.create({
          data: {
            projectId,
            characterId: character.id,
            title: input.title,
            body: input.body,
            category: input.category,
            importance: input.importance,
            relatedSceneId: input.relatedSceneId,
          },
        }),
      }, { status: 201 });
    }
    const actionMap = {
      "save-world-note": ["world-notes"],
      "save-foreshadowing": ["foreshadowings"],
      "save-plot-thread": ["plot-threads"],
      "save-revision-todo": ["revision-todos"],
      "save-story-state-snapshot": ["story-state-snapshots"],
    } as const;
    if (action in actionMap) return handleWebApi("POST", ["projects", projectId, actionMap[action as keyof typeof actionMap][0]], actor, body);
    return errorResponse("NOT_FOUND", "MCP action not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}
