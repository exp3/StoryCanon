import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";
import { SAMPLES } from "@/lib/sample-project-data";

/** Writes the demo work into the database. Its content lives in lib/sample-project-data.ts. */

export async function findSampleProject(userId: string) {
  return prisma.project.findFirst({
    where: { userId, isSample: true, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Seeds the demo work for a user and returns its id. If one already exists, the
 * existing id is returned and nothing is written — the button is safe to press
 * twice, and safe to press from two tabs.
 *
 * Deliberately does not go through assertCanCreateProject: the sample sits
 * outside the plan quota (see server/plan.ts).
 */
export async function createSampleProject(userId: string, locale: Locale) {
  const existing = await findSampleProject(userId);
  if (existing) return existing.id;

  const data = SAMPLES[locale];

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        userId,
        isSample: true,
        title: data.project.title,
        genre: data.project.genre,
        premise: data.project.premise,
        tone: data.project.tone,
        writingStyle: data.project.writingStyle,
      },
      select: { id: true },
    });
    const projectId = project.id;

    const chapter = await tx.chapter.create({
      data: { projectId, order: 1, ...data.chapter },
      select: { id: true },
    });

    const sceneIds: string[] = [];
    for (const [i, scene] of data.scenes.entries()) {
      const created = await tx.scene.create({
        data: {
          projectId,
          chapterId: chapter.id,
          order: i + 1,
          title: scene.title,
          body: scene.body,
          summary: scene.summary,
          occurredEvents: scene.occurredEvents,
          createdBy: scene.createdBy,
        },
        select: { id: true },
      });
      sceneIds.push(created.id);
    }

    const characterIds: string[] = [];
    for (const character of data.characters) {
      const created = await tx.character.create({
        data: {
          projectId,
          ...character,
          firstSceneId: sceneIds[0] ?? null,
          lastSceneId: sceneIds[sceneIds.length - 1] ?? null,
        },
        select: { id: true },
      });
      characterIds.push(created.id);
    }

    for (const note of data.characterNotes) {
      await tx.characterNote.create({
        data: {
          projectId,
          characterId: characterIds[note.character],
          title: note.title,
          body: note.body,
          category: note.category,
          importance: note.importance,
        },
      });
    }

    await tx.worldNote.createMany({ data: data.worldNotes.map((note) => ({ projectId, ...note })) });

    await tx.foreshadowing.createMany({
      data: data.foreshadowings.map(({ plantedScene, ...rest }) => ({
        projectId,
        ...rest,
        plantedSceneId: plantedScene === null ? null : sceneIds[plantedScene],
      })),
    });

    await tx.mystery.createMany({ data: data.mysteries.map((mystery) => ({ projectId, ...mystery })) });

    await tx.plotThread.createMany({
      data: data.plotThreads.map((thread) => ({ projectId, ...thread, startSceneId: sceneIds[0] ?? null })),
    });

    await tx.revisionTodo.createMany({
      data: data.revisionTodos.map(({ scene, ...rest }) => ({
        projectId,
        ...rest,
        chapterId: chapter.id,
        sceneId: scene === null ? null : sceneIds[scene],
      })),
    });

    await tx.storyStateSnapshot.create({ data: { projectId, ...data.storyState } });

    const tagIds: string[] = [];
    for (const name of data.timelineTags) {
      const created = await tx.timelineTag.create({ data: { projectId, name }, select: { id: true } });
      tagIds.push(created.id);
    }

    for (const [i, event] of data.timelineEvents.entries()) {
      await tx.timelineEvent.create({
        data: {
          projectId,
          order: i + 1,
          title: event.title,
          description: event.description,
          occurredAt: event.occurredAt,
          tags: { connect: event.tags.map((t) => ({ id: tagIds[t] })) },
          characters: { connect: event.characters.map((c) => ({ id: characterIds[c] })) },
        },
      });
    }

    return projectId;
  });
}
