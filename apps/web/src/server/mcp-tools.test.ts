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

  it("gives every tool exactly one place to send its arguments", () => {
    for (const tool of MCP_TOOLS) {
      expect(Boolean(tool.action) !== Boolean(tool.route), tool.name).toBe(true);
    }
  });

  it("builds route paths from the arguments the schema declares", () => {
    for (const tool of MCP_TOOLS) {
      if (!tool.route) continue;
      const args = Object.fromEntries((tool.required ?? []).map((key) => [key, `test-${key}`]));
      const path = tool.route.path(args);
      // An empty segment means a required argument never reached the path and
      // the request would silently hit the wrong route.
      expect(path.every((segment) => segment.length > 0), `${tool.name}: ${path.join("/")}`).toBe(true);
    }
  });

  it("routes the project-scoped reads through the project", () => {
    const listScenes = MCP_TOOLS.find((tool) => tool.name === "list_scenes");
    expect(listScenes?.route?.path({ projectId: "p1" })).toEqual(["projects", "p1", "scenes"]);
    const getScene = MCP_TOOLS.find((tool) => tool.name === "get_scene");
    expect(getScene?.route?.path({ sceneId: "s1" })).toEqual(["scenes", "s1"]);
  });

  it("defaults the export format rather than building a broken path", () => {
    const exportProject = MCP_TOOLS.find((tool) => tool.name === "export_project");
    expect(exportProject?.route?.path({ projectId: "p1" })).toEqual(["projects", "p1", "export", "markdown"]);
    expect(exportProject?.route?.path({ projectId: "p1", format: "json" })).toEqual(["projects", "p1", "export", "json"]);
  });

  it("marks every read-only tool as GET", () => {
    for (const tool of MCP_TOOLS) {
      if (tool.route && tool.readOnly) expect(tool.route.method, tool.name).toBe("GET");
      if (tool.route?.method === "GET") expect(tool.readOnly, tool.name).toBe(true);
    }
  });

  it("lets delete_project_data name every type the server can delete", () => {
    // The handler's mutationTargets and this enum have to stay in step: a type
    // missing here is rejected by schema validation before the handler ever
    // sees it, so the tool silently cannot delete something the API supports.
    const deleteTool = MCP_TOOLS.find((tool) => tool.name === "delete_project_data");
    const targetType = deleteTool?.properties.targetType as { enum?: string[] };
    expect(targetType.enum).toEqual(
      expect.arrayContaining(["PROJECT", "SCENE", "CHARACTER", "TIMELINE_EVENT", "TIMELINE_TAG"]),
    );
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
