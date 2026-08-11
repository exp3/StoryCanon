import { describe, expect, it } from "vitest";
import { locales } from "./i18n";
import { SAMPLES } from "./sample-project-data";

/**
 * The sample work links its entities together by array index (a foreshadowing
 * points at the scene that planted it, a timeline event at its characters). An
 * out-of-range index type-checks fine and then hands Prisma `undefined` as a
 * foreign key at seed time, which fails for whoever pressed the button rather
 * than in CI. These tests are what catch that.
 */
describe.each(locales)("sample project data (%s)", (locale) => {
  const data = SAMPLES[locale];

  it("points every character note at a real character", () => {
    for (const note of data.characterNotes) {
      expect(data.characters[note.character]).toBeDefined();
    }
  });

  it("points every planted foreshadowing at a real scene", () => {
    for (const item of data.foreshadowings) {
      if (item.plantedScene === null) continue;
      expect(data.scenes[item.plantedScene]).toBeDefined();
    }
  });

  it("points every scene-scoped revision todo at a real scene", () => {
    for (const todo of data.revisionTodos) {
      if (todo.scene === null) continue;
      expect(data.scenes[todo.scene]).toBeDefined();
    }
  });

  it("points every timeline event at real tags and characters", () => {
    for (const event of data.timelineEvents) {
      for (const tag of event.tags) expect(data.timelineTags[tag]).toBeDefined();
      for (const character of event.characters) expect(data.characters[character]).toBeDefined();
    }
  });

  it("has unique character names, which the schema requires per project", () => {
    const names = data.characters.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has unique timeline tag names, which the schema requires per project", () => {
    expect(new Set(data.timelineTags).size).toBe(data.timelineTags.length);
  });

  // The whole reason the sample exists is to show a filled-in structure, so an
  // entity list quietly emptied out would defeat it.
  it("fills in every entity type", () => {
    expect(data.scenes.length).toBeGreaterThan(0);
    expect(data.characters.length).toBeGreaterThan(0);
    expect(data.characterNotes.length).toBeGreaterThan(0);
    expect(data.worldNotes.length).toBeGreaterThan(0);
    expect(data.foreshadowings.length).toBeGreaterThan(0);
    expect(data.mysteries.length).toBeGreaterThan(0);
    expect(data.plotThreads.length).toBeGreaterThan(0);
    expect(data.revisionTodos.length).toBeGreaterThan(0);
    expect(data.timelineEvents.length).toBeGreaterThan(0);
  });
});

describe("sample project locale parity", () => {
  const en = SAMPLES.en;
  const ja = SAMPLES.ja;

  // Not a formatting nicety: the entity counts are what the demo is showing off,
  // so a locale that quietly lost half its foreshadowing is a broken demo.
  it.each([
    ["scenes", en.scenes.length, ja.scenes.length],
    ["characters", en.characters.length, ja.characters.length],
    ["characterNotes", en.characterNotes.length, ja.characterNotes.length],
    ["worldNotes", en.worldNotes.length, ja.worldNotes.length],
    ["foreshadowings", en.foreshadowings.length, ja.foreshadowings.length],
    ["mysteries", en.mysteries.length, ja.mysteries.length],
    ["plotThreads", en.plotThreads.length, ja.plotThreads.length],
    ["revisionTodos", en.revisionTodos.length, ja.revisionTodos.length],
    ["timelineEvents", en.timelineEvents.length, ja.timelineEvents.length],
    ["timelineTags", en.timelineTags.length, ja.timelineTags.length],
  ])("has the same number of %s in both locales", (_name, enCount, jaCount) => {
    expect(jaCount).toBe(enCount);
  });

  it("has no empty strings", () => {
    const empty: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (typeof value === "string") {
        if (value.trim() === "") empty.push(path);
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
      } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
      }
    };
    for (const locale of locales) walk(SAMPLES[locale], locale);
    expect(empty).toEqual([]);
  });
});
