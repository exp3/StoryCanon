import { describe, expect, it } from "vitest";
import { getDictionary, locales } from "./i18n";

const en = getDictionary("en");
const ja = getDictionary("ja");

/**
 * `const ja: typeof en` forces the key structure to match, but because `en` is
 * not `as const` its arrays infer as plain arrays — so a `ja` array with a
 * missing entry compiles clean and silently drops a card from the page. These
 * tests are the only thing standing between that and production.
 */
describe("landing dictionary parity", () => {
  const arrays: [string, unknown[], unknown[]][] = [
    ["heroMock.tabs", en.landing.heroMock.tabs, ja.landing.heroMock.tabs],
    ["heroMock.stateLines", en.landing.heroMock.stateLines, ja.landing.heroMock.stateLines],
    ["heroMock.stats", en.landing.heroMock.stats, ja.landing.heroMock.stats],
    ["audience.audience", en.landing.audience.audience, ja.landing.audience.audience],
    ["audience.pains", en.landing.audience.pains, ja.landing.audience.pains],
    ["framework.entities", en.landing.framework.entities, ja.landing.framework.entities],
    ["framework.lifecycles", en.landing.framework.lifecycles, ja.landing.framework.lifecycles],
    ["framework.fixedFields", en.landing.framework.fixedFields, ja.landing.framework.fixedFields],
    ["ai.points", en.landing.ai.points, ja.landing.ai.points],
    ["ai.clients", en.landing.ai.clients, ja.landing.ai.clients],
    ["ai.trademarks", en.landing.ai.trademarks, ja.landing.ai.trademarks],
    ["solo.points", en.landing.solo.points, ja.landing.solo.points],
    ["flow.steps", en.landing.flow.steps, ja.landing.flow.steps],
    ["policy.points", en.landing.policy.points, ja.landing.policy.points],
  ];

  it.each(arrays)("%s has the same length in both locales", (_name, enValue, jaValue) => {
    expect(jaValue).toHaveLength(enValue.length);
  });

  it("has matching stage counts for every lifecycle", () => {
    expect(ja.landing.framework.lifecycles.map((l) => l.stages.length)).toEqual(
      en.landing.framework.lifecycles.map((l) => l.stages.length),
    );
  });

  // The framework section claims "12 entity types" in prose elsewhere; keep the
  // list honest if the schema grows.
  it("lists thirteen project entities", () => {
    expect(en.landing.framework.entities).toHaveLength(13);
  });

  // Every product named in the MCP client list is someone else's trademark, so
  // a fourth client must not ship without its attribution line.
  it.each(locales)("attributes every named MCP client for %s", (locale) => {
    const { clients, trademarks } = getDictionary(locale).landing.ai;
    for (const client of clients) {
      expect(trademarks.some((line) => line.includes(client.name))).toBe(true);
    }
  });
});

describe("landing copy is filled in", () => {
  it.each(locales)("has no empty landing strings for %s", (locale) => {
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
    walk(getDictionary(locale).landing, "landing");
    expect(empty).toEqual([]);
  });
});
