import { describe, expect, it } from "vitest";
import { MCP_TOOLS, describeFailure, toToolResult, toolInputSchema } from "./mcp-tools";

/**
 * The MCP tool definitions are the contract every client reads, and the
 * response shaping decides whether a model sees a fixable error or a dead
 * end. Neither is covered by anything else — there are no tests for the HTTP
 * layer at all.
 */

describe("tool definitions", () => {
  it("has unique snake_case names", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("only marks properties as required when they exist", () => {
    for (const tool of MCP_TOOLS) {
      for (const key of tool.required ?? []) {
        expect(Object.keys(tool.properties), `${tool.name}.${key}`).toContain(key);
      }
    }
  });

  it("requires projectId on every tool that operates on one work", () => {
    for (const tool of MCP_TOOLS) {
      if (!("projectId" in tool.properties)) continue;
      expect(tool.required ?? [], tool.name).toContain("projectId");
    }
  });

  it("compiles every input schema", () => {
    for (const tool of MCP_TOOLS) {
      expect(() => toolInputSchema(tool), tool.name).not.toThrow();
    }
  });

  it("requires a scene title, which the OpenAPI surface does not", () => {
    // The ChatGPT spec only requires projectId + body, but the server's zod
    // schema also requires a title, so that call always 400s. Guard against
    // reintroducing the same gap here.
    const saveScene = MCP_TOOLS.find((tool) => tool.name === "save_scene");
    expect(saveScene?.required).toEqual(expect.arrayContaining(["projectId", "title", "body"]));
  });

  it("makes save_character demand either characterId or name", () => {
    // Neither one is unconditionally required, but the handler's create path
    // parses a zod schema that requires a name — so a call with neither always
    // 400s. Same class of gap as save_scene above.
    const saveCharacter = MCP_TOOLS.find((tool) => tool.name === "save_character");
    expect(saveCharacter?.anyOf).toEqual([{ required: ["characterId"] }, { required: ["name"] }]);
  });

  it("marks read-only tools as such and never marks them destructive", () => {
    for (const tool of MCP_TOOLS) {
      if (tool.readOnly) expect(tool.destructive ?? false, tool.name).toBe(false);
    }
    expect(MCP_TOOLS.filter((tool) => tool.readOnly).map((tool) => tool.name)).toContain("get_project_context");
    expect(MCP_TOOLS.filter((tool) => tool.destructive).map((tool) => tool.name)).toContain("delete_project_data");
  });
});

describe("toToolResult", () => {
  it("passes a successful JSON body straight through", () => {
    const result = toToolResult(200, "application/json", '{"projects":[]}');
    expect(result).toEqual({ content: [{ type: "text", text: '{"projects":[]}' }] });
  });

  it("treats 201 as success", () => {
    expect(toToolResult(201, "application/json", "{}")?.isError).toBeUndefined();
  });

  it("substitutes an empty object for an empty success body", () => {
    expect(toToolResult(200, "application/json", "")).toEqual({ content: [{ type: "text", text: "{}" }] });
  });

  it("returns a 4xx as a tool error carrying the server's message", () => {
    const body = '{"error":"VALIDATION_ERROR","message":"Request body is invalid."}';
    const result = toToolResult(400, "application/json", body);
    expect(result).toEqual({ content: [{ type: "text", text: body }], isError: true });
  });

  it("survives the plain-text 404 thrown by the ownership checks", () => {
    // requireOwnedProject throws `new Response("Not found", { status: 404 })`,
    // which has no JSON body to parse.
    const result = toToolResult(404, "text/plain;charset=UTF-8", "Not found");
    expect(result).toEqual({ content: [{ type: "text", text: "HTTP 404: Not found" }], isError: true });
  });

  it("reports an empty error body rather than an empty string", () => {
    expect(describeFailure(403, "", "")).toBe("HTTP 403: (empty response)");
  });

  it("signals 5xx by returning null so the caller throws", () => {
    expect(toToolResult(500, "application/json", '{"error":"INTERNAL_ERROR"}')).toBeNull();
  });
});
