import { describe, expect, it } from "vitest";
import { createProjectSchema, projectFieldLimits } from "./validation";

/**
 * The project settings form and PATCH /api/projects/:id share this schema, so
 * the two things the UI relies on — being able to clear a field, and knowing
 * where each cap sits — have to hold here or the form silently breaks.
 */

const optionalFields = ["genre", "premise", "tone", "targetAudience", "writingStyle", "forbiddenElements", "userPreferences"] as const;

describe("createProjectSchema", () => {
  it("accepts null on every optional field so a set value can be cleared", () => {
    for (const field of optionalFields) {
      const parsed = createProjectSchema.partial().parse({ [field]: null });
      expect(parsed, field).toEqual({ [field]: null });
    }
  });

  it("leaves untouched fields absent rather than defaulting them", () => {
    expect(createProjectSchema.partial().parse({ genre: "SF" })).toEqual({ genre: "SF" });
  });

  it("enforces the advertised cap on every field", () => {
    for (const [field, limit] of Object.entries(projectFieldLimits)) {
      const atLimit = { title: "t", [field]: "a".repeat(limit) };
      expect(createProjectSchema.safeParse(atLimit).success, `${field} at ${limit}`).toBe(true);

      const overLimit = { title: "t", [field]: "a".repeat(limit + 1) };
      expect(createProjectSchema.safeParse(overLimit).success, `${field} over ${limit}`).toBe(false);
    }
  });

  it("covers every field the form can submit", () => {
    // A field added to the schema but missing a limit would render without a
    // maxLength, which is exactly the case that reaches the server as a 400.
    for (const field of Object.keys(createProjectSchema.shape)) {
      expect(projectFieldLimits, field).toHaveProperty(field);
    }
  });

  it("still requires a non-empty title", () => {
    expect(createProjectSchema.safeParse({ title: "" }).success).toBe(false);
    expect(createProjectSchema.safeParse({}).success).toBe(false);
  });
});
