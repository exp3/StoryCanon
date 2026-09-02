import { fromJsonSchema, type JsonSchemaType } from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";

/**
 * MCP tool definitions.
 *
 * Every tool is a thin façade over an existing `handleMcpApi` action, so the
 * MCP surface and the ChatGPT Actions surface (`/api/mcp/*`, described by
 * `/mcp-openapi.json`) execute exactly the same code — ownership checks, plan
 * limits, soft deletes and the mutation log that `rollback_command` undoes.
 *
 * Input schemas are hand-written JSON Schema rather than the zod schemas in
 * `./validation`: those are zod v3 and the MCP SDK speaks zod v4 / Standard
 * Schema. This is not a second source of truth — the schemas here describe the
 * call for the model, while `./validation` remains the only thing that
 * *enforces* anything at runtime.
 */

/**
 * The interpreting validator, not the Ajv one, on every runtime.
 *
 * Ajv compiles each schema by generating source and handing it to `new
 * Function`, which workerd refuses outright — so in production every tool
 * registration threw and `/mcp` answered 500 to an authenticated client. It
 * survived review because `next dev` runs on Node, where Ajv is fine, and
 * because the requests that are cheap to make by hand stop at 401 or 403
 * before any tool is registered.
 *
 * Kept unconditional rather than chosen per runtime: one validator everywhere
 * means local development exercises the engine production runs. It carries no
 * extra dependency — the SDK bundles `@cfworker/json-schema` — and these
 * schemas are validated once per call, so interpreting them costs nothing
 * that matters here.
 */
const validator = new CfWorkerJsonSchemaValidator();

const projectId = { type: "string", description: "対象作品の ID / The project id." } as const;
const importance = { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] } as const;

export type McpToolSpec = {
  name: string;
  title: string;
  description: string;
  /**
   * Where the tool sends its arguments. Most tools reuse a `handleMcpApi`
   * action; the read tools reuse the REST routes in `handleWebApi`, which
   * already have the list and fetch endpoints the action surface never grew.
   */
  action?: string;
  route?: { method: "GET" | "POST"; path: (args: Record<string, unknown>) => string[] };
  properties: NonNullable<JsonSchemaType["properties"]>;
  required?: string[];
  /** Extra constraint for tools where one of several fields must be present. */
  anyOf?: JsonSchemaType["anyOf"];
  readOnly?: boolean;
  destructive?: boolean;
};

const str = (args: Record<string, unknown>, key: string) => String(args[key] ?? "");

export const MCP_TOOLS: McpToolSpec[] = [
  {
    name: "help",
    title: "How to use StoryCanon",
    description:
      "Explains how to work with StoryCanon: the first-time steps, the typical write loop, and what every other tool does. Call this first if you have not used StoryCanon before.",
    action: "help",
    properties: {},
    readOnly: true,
  },
  {
    name: "list_projects",
    title: "List works",
    description: "Lists the signed-in user's works (private novels) with their id, title, genre and last update.",
    action: "list-private-projects",
    properties: {},
    readOnly: true,
  },
  {
    name: "create_project",
    title: "Create a work",
    description: "Creates a new private work. Returns the new project id plus a commandId that rollback_command can undo.",
    action: "create-private-project",
    properties: {
      title: { type: "string", description: "作品タイトル / Title of the work." },
      genre: { type: "string" },
      premise: { type: "string", description: "作品の前提・あらすじ / One-paragraph premise." },
      tone: { type: "string" },
      targetAudience: { type: "string" },
      writingStyle: { type: "string" },
      forbiddenElements: { type: "string", description: "書かないでほしい要素 / Elements the author never wants written." },
      userPreferences: { type: "string" },
    },
    required: ["title"],
  },
  {
    name: "update_project",
    title: "Update a work",
    description: "Updates a work's title or settings. Only the fields you pass are changed.",
    action: "update-private-project",
    properties: {
      projectId,
      title: { type: "string" },
      genre: { type: "string" },
      premise: { type: "string" },
      tone: { type: "string" },
      targetAudience: { type: "string" },
      writingStyle: { type: "string" },
      forbiddenElements: { type: "string" },
      userPreferences: { type: "string" },
    },
    required: ["projectId"],
  },
  {
    name: "get_project_context",
    title: "Get the current state of a work",
    description:
      "Returns everything needed to write the next scene: the work's settings, the latest story state, the cast, active plot threads, unresolved foreshadowing and the mysteries. Call this before writing.",
    action: "get-private-project-context",
    properties: { projectId },
    required: ["projectId"],
    readOnly: true,
  },
  {
    name: "get_next_generation_context",
    title: "Get context for the next scene",
    description: "Alias of get_project_context, kept for parity with the ChatGPT integration. Returns the same payload.",
    action: "get-next-generation-context",
    properties: { projectId },
    required: ["projectId"],
    readOnly: true,
  },
  {
    name: "consult_title",
    title: "Brainstorm titles",
    description:
      "Returns the context and guidance needed to propose title candidates for a work. Writes nothing — apply a chosen title with update_project.",
    action: "consult-title",
    properties: {
      projectId,
      direction: { type: "string", description: "希望する方向性やキーワード / Desired direction or keywords." },
      count: { type: "integer", description: "候補数 3〜12(既定 6)/ How many candidates, 3-12 (default 6)." },
    },
    required: ["projectId"],
    readOnly: true,
  },
  {
    name: "save_scene",
    title: "Save a scene",
    description:
      "Saves generated prose as a scene, recorded as written by AI. If chapterTitle names a chapter that does not exist yet it is created. Returns a commandId that rollback_command can undo.",
    action: "save-generated-scene",
    properties: {
      projectId,
      title: { type: "string", description: "シーンのタイトル / Scene title." },
      sceneTitle: { type: "string", description: "title の別名(どちらか一方でよい)/ Alias for title." },
      body: { type: "string", description: "本文 / The prose itself." },
      summary: { type: "string" },
      occurredEvents: { type: "string", description: "このシーンで起きたこと / What happened in this scene." },
      chapterId: { type: "string" },
      chapterTitle: { type: "string", description: "章タイトル。無ければ作成される / Chapter title; created when missing." },
      generationPrompt: { type: "string" },
    },
    // The OpenAPI spec only requires projectId + body, but the server's zod
    // schema also requires a title — so a caller that omits it always gets a
    // 400. Requiring it here keeps the model from making that mistake.
    required: ["projectId", "title", "body"],
  },
  {
    name: "save_character",
    title: "Save a character",
    description:
      "Creates or updates a character. Pass characterId to update a specific one, or name alone to update the character with that name (creating it when absent).",
    action: "save-character",
    properties: {
      projectId,
      characterId: { type: "string", description: "更新対象の ID(新規なら省略)/ Omit when creating." },
      name: { type: "string", description: "キャラクター名 / Character name." },
      role: { type: "string", description: "物語上の役割 / Role in the story." },
      age: { type: "string" },
      personality: { type: "string" },
      speechStyle: { type: "string", description: "口調 / How they speak." },
      appearance: { type: "string" },
      background: { type: "string" },
      goal: { type: "string" },
      secret: { type: "string" },
      currentState: { type: "string" },
    },
    required: ["projectId"],
    // Without characterId the handler falls through to the create path, whose
    // zod schema requires a name — so a call with neither always 400s.
    anyOf: [{ required: ["characterId"] }, { required: ["name"] }],
  },
  {
    name: "save_character_note",
    title: "Save a character note",
    description: "Saves a note about a character. An unknown characterName is created automatically.",
    action: "save-character-note",
    properties: {
      projectId,
      characterId: { type: "string" },
      characterName: { type: "string" },
      title: { type: "string" },
      body: { type: "string" },
      category: { type: "string", enum: ["INNER", "RELATIONSHIP", "BACKGROUND", "SPEECH", "PLOT", "OTHER"] },
      importance,
      relatedSceneId: { type: "string" },
    },
    required: ["projectId", "body"],
  },
  {
    name: "save_world_note",
    title: "Save a world note",
    description: "Saves a world-building note (place, organization, technology, history, culture, item or rule).",
    action: "save-world-note",
    properties: {
      projectId,
      title: { type: "string" },
      body: { type: "string" },
      category: {
        type: "string",
        enum: ["PLACE", "ORGANIZATION", "TECHNOLOGY", "HISTORY", "CULTURE", "ITEM", "RULE", "OTHER"],
      },
      importance,
      relatedSceneId: { type: "string" },
    },
    required: ["projectId", "title", "body"],
  },
  {
    name: "save_foreshadowing",
    title: "Save foreshadowing",
    description: "Records a piece of foreshadowing: where it was planted, how it is meant to pay off, and whether it has.",
    action: "save-foreshadowing",
    properties: {
      projectId,
      title: { type: "string" },
      description: { type: "string" },
      plantedSceneId: { type: "string" },
      plannedResolution: { type: "string" },
      resolvedSceneId: { type: "string" },
      status: { type: "string", enum: ["UNPLANTED", "PLANTED", "IN_PROGRESS", "RESOLVED", "DROPPED"] },
      importance,
    },
    required: ["projectId", "title", "description"],
  },
  {
    name: "save_mystery",
    title: "Save a mystery",
    description: "Records a mystery: the question, the truth, who knows it, the clues and the reveal point.",
    action: "save-mystery",
    properties: {
      projectId,
      scope: { type: "string", enum: ["CENTRAL", "ARC", "EPISODE", "SCENE"] },
      question: { type: "string" },
      truth: { type: "string" },
      knownBy: { type: "string" },
      clues: { type: "string" },
      revealPoint: { type: "string" },
    },
    required: ["projectId", "question"],
  },
  {
    name: "save_plot_thread",
    title: "Save a plot thread",
    description: "Records a plot thread: what is running, where it stands, and what would resolve it.",
    action: "save-plot-thread",
    properties: {
      projectId,
      title: { type: "string" },
      description: { type: "string" },
      status: { type: "string", enum: ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "DROPPED"] },
      startSceneId: { type: "string" },
      currentState: { type: "string" },
      resolutionCondition: { type: "string" },
    },
    required: ["projectId", "title"],
  },
  {
    name: "save_revision_todo",
    title: "Save a revision TODO",
    description: "Records something to fix later: the problem, a suggested fix and a priority.",
    action: "save-revision-todo",
    properties: {
      projectId,
      title: { type: "string" },
      problem: { type: "string" },
      suggestion: { type: "string" },
      priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "DONE", "ON_HOLD", "DROPPED"] },
      chapterId: { type: "string" },
      sceneId: { type: "string" },
    },
    required: ["projectId", "title", "problem"],
  },
  {
    name: "save_story_state",
    title: "Save the story state",
    description:
      "Appends a snapshot of where the story now stands. Save one after writing so the next session starts from the right place.",
    action: "save-story-state-snapshot",
    properties: {
      projectId,
      summary: { type: "string" },
      recentEvents: { type: "string" },
      characterStates: { type: "string" },
      unresolvedProblems: { type: "string" },
      unresolvedForeshadowings: { type: "string" },
      activePlotThreads: { type: "string" },
      nextOptions: { type: "string" },
      avoidElements: { type: "string" },
      writingRules: { type: "string" },
      userPreferences: { type: "string" },
    },
    required: ["projectId", "summary"],
  },
  {
    name: "delete_project_data",
    title: "Delete data from a work",
    description:
      "Logically deletes one record under a work (or the work itself when targetType is PROJECT). Nothing is physically removed, and the returned undoToken restores it via rollback_command.",
    action: "delete-project-data",
    properties: {
      projectId,
      targetType: {
        type: "string",
        enum: [
          "PROJECT",
          "CHAPTER",
          "SCENE",
          "CHARACTER",
          "CHARACTER_NOTE",
          "WORLD_NOTE",
          "FORESHADOWING",
          "MYSTERY",
          "PLOT_THREAD",
          "REVISION_TODO",
          "STORY_STATE_SNAPSHOT",
          "TIMELINE_EVENT",
          "TIMELINE_TAG",
        ],
      },
      targetId: { type: "string", description: "削除対象の ID。targetType が PROJECT なら省略可 / Optional when targetType is PROJECT." },
      reason: { type: "string" },
    },
    required: ["projectId", "targetType"],
    destructive: true,
  },
  {
    name: "rollback_command",
    title: "Undo a specific change",
    description:
      "Undoes one save, update or delete by its commandId, or a whole transaction by transactionId. Pass force to undo even when a later change touched the same record.",
    action: "rollback-command",
    properties: {
      projectId,
      commandId: { type: "string" },
      transactionId: { type: "string" },
      force: { type: "boolean" },
    },
    required: ["projectId"],
    destructive: true,
  },
  {
    name: "undo_last_command",
    title: "Undo the last change",
    description: "Undoes the most recent change made to a work.",
    action: "undo-last-command",
    properties: { projectId, force: { type: "boolean" } },
    required: ["projectId"],
    destructive: true,
  },

  // Reading back what was saved. The action surface can write all of these but
  // could only read a few of them, which left a model unable to check its own
  // work without re-fetching the whole project context.
  ...([
    ["list_chapters", "chapters", "Lists the chapters of a work, in order."],
    ["list_scenes", "scenes", "Lists the scenes of a work, in reading order, including their body text."],
    ["list_characters", "characters", "Lists the characters of a work with their full profiles."],
    ["list_world_notes", "world-notes", "Lists the world notes of a work."],
    ["list_foreshadowings", "foreshadowings", "Lists the foreshadowing recorded for a work, including resolved items."],
    ["list_mysteries", "mysteries", "Lists the mysteries recorded for a work."],
    ["list_plot_threads", "plot-threads", "Lists the plot threads of a work, including finished ones."],
    ["list_revision_todos", "revision-todos", "Lists the revision TODOs of a work, including completed ones."],
    ["list_story_states", "story-state-snapshots", "Lists the story state snapshots of a work, newest first."],
  ] as const).map(([name, collection, description]): McpToolSpec => ({
    name,
    title: name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    description,
    route: { method: "GET", path: (args) => ["projects", str(args, "projectId"), collection] },
    properties: { projectId },
    required: ["projectId"],
    readOnly: true,
  })),
  {
    name: "get_scene",
    title: "Get a scene",
    description: "Fetches one scene by id, including its full body text.",
    route: { method: "GET", path: (args) => ["scenes", str(args, "sceneId")] },
    properties: { sceneId: { type: "string", description: "シーンの ID / The scene id." } },
    required: ["sceneId"],
    readOnly: true,
  },
  {
    name: "get_character",
    title: "Get a character",
    description: "Fetches one character by id, with the full profile.",
    route: { method: "GET", path: (args) => ["characters", str(args, "characterId")] },
    properties: { characterId: { type: "string", description: "キャラクターの ID / The character id." } },
    required: ["characterId"],
    readOnly: true,
  },
  {
    name: "list_character_notes",
    title: "List character notes",
    description: "Lists the notes saved against one character.",
    route: { method: "GET", path: (args) => ["characters", str(args, "characterId"), "notes"] },
    properties: { characterId: { type: "string" } },
    required: ["characterId"],
    readOnly: true,
  },
  {
    name: "get_latest_story_state",
    title: "Get the latest story state",
    description: "Fetches only the most recent story state snapshot, without the rest of the project context.",
    route: { method: "GET", path: (args) => ["projects", str(args, "projectId"), "story-state", "latest"] },
    properties: { projectId },
    required: ["projectId"],
    readOnly: true,
  },
  {
    name: "export_project",
    title: "Export a work",
    description:
      "Exports the whole work as one document. Markdown and plain text are available on every plan; JSON needs a paid plan.",
    route: { method: "GET", path: (args) => ["projects", str(args, "projectId"), "export", str(args, "format") || "markdown"] },
    properties: {
      projectId,
      format: { type: "string", enum: ["markdown", "text", "json"], description: "既定は markdown / Defaults to markdown." },
    },
    required: ["projectId"],
    readOnly: true,
  },

  // Timeline. Until now this existed only in the web UI, so neither ChatGPT
  // nor an MCP client could see when anything happened in the story.
  {
    name: "list_timeline_events",
    title: "List timeline events",
    description:
      "Lists the in-story events of a work in chronological order, with the characters involved and the tags on each.",
    route: { method: "GET", path: (args) => ["projects", str(args, "projectId"), "timeline-events"] },
    properties: { projectId },
    required: ["projectId"],
    readOnly: true,
  },
  {
    name: "save_timeline_event",
    title: "Save a timeline event",
    description:
      "Records something that happens in the story. The in-story date is free text; `order` is what the timeline sorts by, and defaults to the end.",
    route: { method: "POST", path: (args) => ["projects", str(args, "projectId"), "timeline-events"] },
    properties: {
      projectId,
      title: { type: "string", description: "出来事 / What happens." },
      description: { type: "string" },
      occurredAt: { type: "string", description: "作中の日時。自由記述 / In-story date, free text (e.g. \"Imperial year 302, spring\")." },
      order: { type: "integer", description: "並び順。省略すると末尾 / Sort position; appended when omitted." },
      characterIds: { type: "array", items: { type: "string" }, description: "関わるキャラクターの ID / Characters involved." },
      tagIds: { type: "array", items: { type: "string" }, description: "タグの ID。list_timeline_tags で取得 / Tag ids from list_timeline_tags." },
    },
    required: ["projectId", "title"],
  },
  {
    name: "list_timeline_tags",
    title: "List timeline tags",
    description: "Lists the tags available for timeline events in a work.",
    route: { method: "GET", path: (args) => ["projects", str(args, "projectId"), "timeline-tags"] },
    properties: { projectId },
    required: ["projectId"],
    readOnly: true,
  },
  {
    name: "save_timeline_tag",
    title: "Save a timeline tag",
    description: "Creates a timeline tag, or revives one with the same name that was removed earlier.",
    route: { method: "POST", path: (args) => ["projects", str(args, "projectId"), "timeline-tags"] },
    properties: { projectId, name: { type: "string", description: "タグ名 / Tag name." } },
    required: ["projectId", "name"],
  },
];

/** Converts a spec's properties into the Standard Schema the SDK advertises and validates against. */
export function toolInputSchema(spec: McpToolSpec) {
  const schema: JsonSchemaType = {
    type: "object",
    properties: spec.properties,
    required: spec.required ?? [],
    additionalProperties: false,
    ...(spec.anyOf ? { anyOf: spec.anyOf } : {}),
  };
  return fromJsonSchema<Record<string, unknown>>(schema, validator);
}

export function describeFailure(status: number, contentType: string, body: string) {
  // `requireOwnedProject` and friends throw a plain-text 404, so the body is
  // not always JSON — never assume it parses.
  if (contentType.includes("application/json") && body) return body;
  return `HTTP ${status}: ${body || "(empty response)"}`;
}

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Shapes one API response into an MCP tool result.
 *
 * A 4xx comes back as a tool error rather than a JSON-RPC error: the model
 * caused it (bad arguments, unknown id, plan limit) and can usually fix it on
 * the next call, so it needs to see the message. A 5xx is a genuine failure
 * and is signalled by returning null so the caller can throw.
 */
export function toToolResult(status: number, contentType: string, body: string): McpToolResult | null {
  if (status >= 200 && status < 300) {
    return { content: [{ type: "text", text: body || "{}" }] };
  }
  if (status >= 500) return null;
  return { content: [{ type: "text", text: describeFailure(status, contentType, body) }], isError: true };
}
