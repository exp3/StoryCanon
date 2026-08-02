import { describe, expect, it } from "vitest";
import { pickAcceptLanguage } from "./accept-language";

describe("pickAcceptLanguage", () => {
  it.each([null, undefined, ""])("returns null for %j", (value) => {
    expect(pickAcceptLanguage(value)).toBeNull();
  });

  it("returns null when nothing supported is requested", () => {
    expect(pickAcceptLanguage("de-DE,de;q=0.9,fr;q=0.8")).toBeNull();
  });

  it.each([
    ["ja", "ja"],
    ["ja-JP", "ja"],
    ["JA-jp", "ja"],
    ["en-US,en;q=0.9", "en"],
    ["ja,en-US;q=0.9,en;q=0.8", "ja"],
    ["en-US,en;q=0.9,ja;q=0.8", "en"],
    ["  ja-JP ; q=0.9 , en ; q=0.8 ", "ja"],
  ])("maps %j to %j", (header, expected) => {
    expect(pickAcceptLanguage(header)).toBe(expected);
  });

  // The case a first-tag-only implementation gets wrong: the preferred locale
  // is supported but is not the first tag.
  it("skips unsupported leading tags", () => {
    expect(pickAcceptLanguage("fr-FR,ja;q=0.9,en;q=0.8")).toBe("ja");
  });
});
