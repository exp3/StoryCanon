import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { createTimelineEventSchema, createTimelineTagSchema } from "@/server/validation";
import { CopyButton } from "@/components/copy-button";
import { TimelineReorderList } from "@/components/timeline-reorder-list";

type SearchParams = { character?: string | string[]; tag?: string | string[] };

type Option = { id: string; name: string };

/** Matches the `.max()` on characterIds / tagIds in createTimelineEventSchema. */
const RELATION_LIMIT = 200;

function toArray(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function requireOwnedProject(projectId: string) {
  const currentUser = await requireSessionUser();
  const owned = await prisma.project.findFirst({
    where: { id: projectId, userId: currentUser.id, deletedAt: null },
    select: { id: true },
  });
  if (!owned) notFound();
  return owned;
}

/**
 * Checkbox values arrive from the browser, so they are re-checked against the
 * project before being connected — otherwise a crafted form could attach
 * another project's character to this timeline.
 */
async function ownedRelationIds(projectId: string, formData: FormData) {
  // Capped before the query, not after: the schema's own `.max()` runs later, so
  // without this a crafted post could build an enormous `IN (...)`.
  const requestedCharacterIds = formData.getAll("characterId").map(String).slice(0, RELATION_LIMIT);
  const requestedTagIds = formData.getAll("tagId").map(String).slice(0, RELATION_LIMIT);
  const [ownedCharacters, ownedTags] = await Promise.all([
    requestedCharacterIds.length === 0
      ? []
      : prisma.character.findMany({ where: { projectId, deletedAt: null, id: { in: requestedCharacterIds } }, select: { id: true } }),
    requestedTagIds.length === 0
      ? []
      : prisma.timelineTag.findMany({ where: { projectId, deletedAt: null, id: { in: requestedTagIds } }, select: { id: true } }),
  ]);
  return {
    characterIds: ownedCharacters.map((item) => item.id),
    tagIds: ownedTags.map((item) => item.id),
  };
}

function parseEvent(formData: FormData, relations: { characterIds: string[]; tagIds: string[] }) {
  const rawOrder = String(formData.get("order") ?? "").trim();
  return createTimelineEventSchema.parse({
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    occurredAt: String(formData.get("occurredAt") ?? "").trim() || undefined,
    order: rawOrder === "" ? undefined : Number(rawOrder),
    characterIds: relations.characterIds,
    tagIds: relations.tagIds,
  });
}

/**
 * The create and edit forms take the same fields, so they share one renderer.
 * Character and tag pickers are plain checkboxes: a timeline event belongs to
 * any number of both.
 */
function EventFields({
  t,
  characters,
  tags,
  event,
  defaultOrder,
}: {
  t: Dictionary["timeline"];
  characters: Option[];
  tags: Option[];
  event?: {
    title: string;
    occurredAt: string | null;
    order: number;
    description: string | null;
    characters: Option[];
    tags: Option[];
  };
  defaultOrder: number;
}) {
  const selectedCharacters = new Set((event?.characters ?? []).map((item) => item.id));
  const selectedTags = new Set((event?.tags ?? []).map((item) => item.id));

  return (
    <>
      <label className="block">
        <span className="text-sm font-medium">{t.titleLabel}</span>
        <input className="mt-1 w-full rounded border px-3 py-2" name="title" defaultValue={event?.title ?? ""} maxLength={160} required />
      </label>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="block">
          <span className="text-sm font-medium">{t.occurredAtLabel}</span>
          <input className="mt-1 w-full rounded border px-3 py-2" name="occurredAt" defaultValue={event?.occurredAt ?? ""} maxLength={120} />
          <span className="mt-1 block text-xs text-[#666]">{t.occurredAtHint}</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.orderLabel}</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="number"
            name="order"
            min={0}
            step={1}
            defaultValue={event?.order ?? defaultOrder}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">{t.descriptionLabel}</span>
        <textarea className="mt-1 min-h-20 w-full rounded border px-3 py-2" name="description" defaultValue={event?.description ?? ""} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">{t.charactersLabel}</legend>
        {characters.length === 0 ? (
          <p className="mt-1 text-sm text-[#555]">{t.noCharacters}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3">
            {characters.map((character) => (
              <label key={character.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="characterId" value={character.id} defaultChecked={selectedCharacters.has(character.id)} />
                {character.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">{t.tagsLabel}</legend>
        {tags.length === 0 ? (
          <p className="mt-1 text-sm text-[#555]">{t.noTags}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="tagId" value={tag.id} defaultChecked={selectedTags.has(tag.id)} />
                {tag.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireSessionUser();
  const { projectId } = await params;
  const query = await searchParams;
  const t = getDictionary(user.locale).timeline;
  const copy = getDictionary(user.locale).common;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, deletedAt: null } });
  if (!project) notFound();

  const [characters, tags] = await Promise.all([
    prisma.character.findMany({ where: { projectId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.timelineTag.findMany({ where: { projectId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // Only ids that still exist in this project can filter, so a stale or
  // hand-written query string cannot silently hide every event.
  const characterIds = new Set(characters.map((item) => item.id));
  const tagIds = new Set(tags.map((item) => item.id));
  const selectedCharacterIds = toArray(query.character).filter((id) => characterIds.has(id));
  const selectedTagIds = toArray(query.tag).filter((id) => tagIds.has(id));
  const filtering = selectedCharacterIds.length > 0 || selectedTagIds.length > 0;

  // Rebuilt from the validated ids rather than reused verbatim, and used as the
  // redirect target so saving an event keeps the filter the user was looking at.
  const filterQuery = new URLSearchParams([
    ...selectedCharacterIds.map((id) => ["character", id] as [string, string]),
    ...selectedTagIds.map((id) => ["tag", id] as [string, string]),
  ]).toString();
  const listPath = `/projects/${projectId}/timeline${filterQuery ? `?${filterQuery}` : ""}`;

  const events = await prisma.timelineEvent.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(selectedCharacterIds.length > 0 ? { characters: { some: { id: { in: selectedCharacterIds } } } } : {}),
      ...(selectedTagIds.length > 0 ? { tags: { some: { id: { in: selectedTagIds } } } } : {}),
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      characters: { where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } },
      tags: { where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });

  const eventCount = await prisma.timelineEvent.count({ where: { projectId, deletedAt: null } });

  async function createEvent(formData: FormData) {
    "use server";

    await requireOwnedProject(projectId);
    const relations = await ownedRelationIds(projectId, formData);
    const input = parseEvent(formData, relations);
    const order = input.order ?? (await prisma.timelineEvent.count({ where: { projectId, deletedAt: null } }));

    await prisma.timelineEvent.create({
      data: {
        projectId,
        title: input.title,
        description: input.description ?? null,
        occurredAt: input.occurredAt ?? null,
        order,
        characters: { connect: input.characterIds.map((id) => ({ id })) },
        tags: { connect: input.tagIds.map((id) => ({ id })) },
      },
    });
    redirect(listPath);
  }

  async function updateEvent(eventId: string, formData: FormData) {
    "use server";

    await requireOwnedProject(projectId);
    const owned = await prisma.timelineEvent.findFirst({
      where: { id: eventId, projectId, deletedAt: null },
      select: {
        id: true,
        order: true,
        // Soft-deleted characters and tags are not rendered as checkboxes, so
        // they never come back in the form. They are carried over explicitly:
        // `set` would otherwise drop links that a rollback could still revive.
        characters: { where: { deletedAt: { not: null } }, select: { id: true } },
        tags: { where: { deletedAt: { not: null } }, select: { id: true } },
      },
    });
    if (!owned) notFound();

    const relations = await ownedRelationIds(projectId, formData);
    const input = parseEvent(formData, relations);
    const characterIds = [...new Set([...input.characterIds, ...owned.characters.map((item) => item.id)])];
    const tagIds = [...new Set([...input.tagIds, ...owned.tags.map((item) => item.id)])];

    await prisma.timelineEvent.update({
      where: { id: owned.id },
      data: {
        title: input.title,
        description: input.description ?? null,
        occurredAt: input.occurredAt ?? null,
        order: input.order ?? owned.order,
        // `set` rather than `connect`: unchecking a box has to detach it.
        characters: { set: characterIds.map((id) => ({ id })) },
        tags: { set: tagIds.map((id) => ({ id })) },
      },
    });
    redirect(listPath);
  }

  /**
   * Drag-and-drop reordering. The client sends where the event landed relative
   * to its visible neighbours, never a whole permutation: the server then
   * recomputes the sequence from the rows as they are now, so a stale or
   * repeated call converges on the same result instead of shuffling the list.
   * Anchoring on a neighbour also keeps events hidden by a filter in place.
   */
  async function moveEvent(eventId: string, afterId: string | null, beforeId: string | null) {
    "use server";

    await requireOwnedProject(projectId);
    const all = await prisma.timelineEvent.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const ids = all.map((event) => event.id);
    if (!ids.includes(eventId)) return;

    const rest = ids.filter((id) => id !== eventId);
    let index: number;
    if (afterId && rest.includes(afterId)) index = rest.indexOf(afterId) + 1;
    else if (beforeId && rest.includes(beforeId)) index = rest.indexOf(beforeId);
    else return;

    const next = [...rest.slice(0, index), eventId, ...rest.slice(index)];
    if (next.join(",") === ids.join(",")) return;

    await prisma.$transaction(next.map((id, order) => prisma.timelineEvent.update({ where: { id }, data: { order } })));
    revalidatePath(`/projects/${projectId}/timeline`);
  }

  async function deleteEvent(eventId: string) {
    "use server";

    await requireOwnedProject(projectId);
    const owned = await prisma.timelineEvent.findFirst({ where: { id: eventId, projectId, deletedAt: null }, select: { id: true } });
    if (!owned) notFound();

    await prisma.timelineEvent.update({ where: { id: owned.id }, data: { deletedAt: new Date() } });
    redirect(listPath);
  }

  async function createTag(formData: FormData) {
    "use server";

    await requireOwnedProject(projectId);
    const input = createTimelineTagSchema.parse({ name: String(formData.get("name") ?? "").trim() });

    // [projectId, name] is unique across soft-deleted rows too, so a name that
    // was deleted earlier is revived instead of colliding.
    const existing = await prisma.timelineTag.findFirst({ where: { projectId, name: input.name }, select: { id: true } });
    if (existing) {
      await prisma.timelineTag.update({ where: { id: existing.id }, data: { deletedAt: null } });
    } else {
      await prisma.timelineTag.create({ data: { projectId, name: input.name } });
    }
    redirect(listPath);
  }

  async function deleteTag(tagId: string) {
    "use server";

    await requireOwnedProject(projectId);
    const owned = await prisma.timelineTag.findFirst({ where: { id: tagId, projectId, deletedAt: null }, select: { id: true } });
    if (!owned) notFound();

    await prisma.timelineTag.update({ where: { id: owned.id }, data: { deletedAt: new Date() } });
    redirect(listPath);
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

      <details className="mb-4 rounded border bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">{t.addNew}</summary>
        <form className="mt-4 space-y-4" action={createEvent}>
          <EventFields t={t} characters={characters} tags={tags} defaultOrder={eventCount} />
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
            {t.create}
          </button>
        </form>
      </details>

      <details className="mb-4 rounded border bg-white p-4" open={filtering}>
        <summary className="cursor-pointer text-sm font-medium">{t.filterHeading}</summary>
        <form className="mt-4 space-y-4" method="get">
          <fieldset>
            <legend className="text-sm font-medium">{t.filterCharacters}</legend>
            {characters.length === 0 ? (
              <p className="mt-1 text-sm text-[#555]">{t.noCharacters}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-3">
                {characters.map((character) => (
                  <label key={character.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="character" value={character.id} defaultChecked={selectedCharacterIds.includes(character.id)} />
                    {character.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">{t.filterTags}</legend>
            {tags.length === 0 ? (
              <p className="mt-1 text-sm text-[#555]">{t.noTags}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-3">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="tag" value={tag.id} defaultChecked={selectedTagIds.includes(tag.id)} />
                    {tag.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <p className="text-xs text-[#666]">{t.filterHint}</p>
          <div className="flex items-center gap-3">
            <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
              {t.filterApply}
            </button>
            {filtering ? (
              <Link className="text-sm text-[#4b4b45] underline" href={`/projects/${projectId}/timeline`}>
                {t.filterClear}
              </Link>
            ) : null}
          </div>
        </form>
      </details>

      <details className="mb-6 rounded border bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">{t.tagsHeading}</summary>
        <form className="mt-4 flex flex-wrap items-end gap-3" action={createTag}>
          <label className="block flex-1">
            <span className="text-sm font-medium">{t.tagNameLabel}</span>
            <input className="mt-1 w-full rounded border px-3 py-2" name="name" maxLength={60} required />
          </label>
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
            {t.tagCreate}
          </button>
        </form>
        {tags.length === 0 ? (
          <p className="mt-4 text-sm text-[#555]">{t.noTags}</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.id} className="flex items-center gap-2 rounded border border-[#ece8dd] px-3 py-1 text-sm">
                {tag.name}
                <form action={deleteTag.bind(null, tag.id)}>
                  <button className="text-xs text-[#a3352b] underline" type="submit">
                    {t.tagDelete}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </details>

      {events.length === 0 ? (
        <p className="text-sm text-[#555]">{filtering ? t.filterEmpty : t.empty}</p>
      ) : (
        <TimelineReorderList
          action={moveEvent}
          labels={{ handle: t.reorderHandle, hint: t.reorderHint, position: t.reorderPosition }}
          items={events.map((event) => ({
            id: event.id,
            label: event.title,
            card: (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {event.occurredAt ? <p className="text-xs text-[#315247]">{event.occurredAt}</p> : null}
                    <p className="mt-1 font-medium">{event.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-[#666]">
                      {t.orderLabel} {event.order}
                    </span>
                    <CopyButton
                      labels={copy}
                      value={[
                        event.occurredAt ? `${event.occurredAt} ${event.title}` : event.title,
                        event.description ?? "",
                        event.characters.length > 0 ? `${t.charactersLabel}: ${event.characters.map((item) => item.name).join(", ")}` : "",
                        event.tags.length > 0 ? `${t.tagsLabel}: ${event.tags.map((item) => item.name).join(", ")}` : "",
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    />
                  </div>
                </div>
                {event.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#555]">{event.description}</p>
                ) : null}
                {event.characters.length > 0 ? (
                  <p className="mt-2 text-sm text-[#4b4b45]">
                    {t.charactersLabel}: {event.characters.map((item) => item.name).join(", ")}
                  </p>
                ) : null}
                {event.tags.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {event.tags.map((tag) => (
                      <li key={tag.id} className="rounded border border-[#ece8dd] px-2 py-1 text-xs text-[#4b4b45]">
                        {tag.name}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-[#4b4b45]">{copy.edit}</summary>
                  <form className="mt-3 space-y-4" action={updateEvent.bind(null, event.id)}>
                    <EventFields t={t} characters={characters} tags={tags} event={event} defaultOrder={event.order} />
                    <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
                      {copy.saveChanges}
                    </button>
                  </form>
                  <form className="mt-3" action={deleteEvent.bind(null, event.id)}>
                    <button className="rounded border border-[#e3b8b3] px-3 py-1 text-xs text-[#a3352b]" type="submit">
                      {t.delete}
                    </button>
                  </form>
                </details>
              </>
            ),
          }))}
        />
      )}
    </main>
  );
}
