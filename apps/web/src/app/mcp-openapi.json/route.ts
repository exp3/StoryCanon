import { NextRequest, NextResponse } from "next/server";

const projectIdProp = { projectId: { type: "string", description: "対象作品のID" } };

function action(
  summary: { operationId: string; text: string },
  propsExtra: Record<string, unknown> = {},
  required: string[] = []
) {
  return {
    post: {
      operationId: summary.operationId,
      summary: summary.text,
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { ...propsExtra },
              required,
            },
          },
        },
      },
      responses: {
        "200": { description: "成功" },
        "201": { description: "作成成功" },
      },
    },
  };
}

export async function GET(req: NextRequest) {
  const serverUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;

  const schema = {
    openapi: "3.1.0",
    info: {
      title: "StoryCanon MCP風 API",
      version: "1.0.0",
      description:
        "StoryCanon の非公開作品データ(本文・キャラクター・世界観・伏線・TODO・現在の物語状態)を、ChatGPT の Custom GPT Action から読み書きするための REST API。",
    },
    servers: [{ url: serverUrl }],
    components: {
      schemas: {},
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "StoryCanon の /settings で発行した API トークン" },
      },
    },
    paths: {
      "/api/mcp/list-private-projects": action({ operationId: "listPrivateProjects", text: "非公開作品一覧を取得する" }),
      "/api/mcp/create-private-project": action(
        { operationId: "createPrivateProject", text: "新しい非公開作品を作成する" },
        {
          title: { type: "string" },
          genre: { type: "string" },
          premise: { type: "string" },
          tone: { type: "string" },
          targetAudience: { type: "string" },
          writingStyle: { type: "string" },
          forbiddenElements: { type: "string" },
          userPreferences: { type: "string" },
        },
        ["title"]
      ),
      "/api/mcp/get-private-project-context": action(
        { operationId: "getPrivateProjectContext", text: "作品の現在状態(要約・キャラ・伏線・進行中プロット)を取得する" },
        { ...projectIdProp },
        ["projectId"]
      ),
      "/api/mcp/get-next-generation-context": action(
        { operationId: "getNextGenerationContext", text: "次回生成に必要な作品コンテキストを取得する(get-private-project-contextと同じ内容)" },
        { ...projectIdProp },
        ["projectId"]
      ),
      "/api/mcp/save-generated-scene": action(
        { operationId: "saveGeneratedScene", text: "生成した本文をシーンとして保存する" },
        {
          ...projectIdProp,
          chapterId: { type: "string" },
          chapterTitle: { type: "string" },
          sceneTitle: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          summary: { type: "string" },
          occurredEvents: { type: "string" },
          generationPrompt: { type: "string" },
        },
        ["projectId", "body"]
      ),
      "/api/mcp/save-character-note": action(
        { operationId: "saveCharacterNote", text: "キャラクターメモを保存する(存在しないキャラ名は自動作成)" },
        {
          ...projectIdProp,
          characterId: { type: "string" },
          characterName: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          category: { type: "string", enum: ["INNER", "RELATIONSHIP", "BACKGROUND", "SPEECH", "PLOT", "OTHER"] },
          importance: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          relatedSceneId: { type: "string" },
        },
        ["projectId", "body"]
      ),
      "/api/mcp/save-world-note": action(
        { operationId: "saveWorldNote", text: "世界観メモを保存する" },
        {
          ...projectIdProp,
          title: { type: "string" },
          body: { type: "string" },
          category: { type: "string", enum: ["PLACE", "ORGANIZATION", "TECHNOLOGY", "HISTORY", "CULTURE", "ITEM", "RULE", "OTHER"] },
          importance: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          relatedSceneId: { type: "string" },
        },
        ["projectId", "title", "body"]
      ),
      "/api/mcp/save-foreshadowing": action(
        { operationId: "saveForeshadowing", text: "伏線を保存する" },
        {
          ...projectIdProp,
          title: { type: "string" },
          description: { type: "string" },
          plantedSceneId: { type: "string" },
          plannedResolution: { type: "string" },
          resolvedSceneId: { type: "string" },
          status: { type: "string", enum: ["UNPLANTED", "PLANTED", "IN_PROGRESS", "RESOLVED", "DROPPED"] },
          importance: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        },
        ["projectId", "title", "description"]
      ),
      "/api/mcp/save-plot-thread": action(
        { operationId: "savePlotThread", text: "進行中プロットを保存する" },
        {
          ...projectIdProp,
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "DROPPED"] },
          startSceneId: { type: "string" },
          currentState: { type: "string" },
          resolutionCondition: { type: "string" },
        },
        ["projectId", "title"]
      ),
      "/api/mcp/save-revision-todo": action(
        { operationId: "saveRevisionTodo", text: "修正TODOを保存する" },
        {
          ...projectIdProp,
          chapterId: { type: "string" },
          sceneId: { type: "string" },
          title: { type: "string" },
          problem: { type: "string" },
          suggestion: { type: "string" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "DONE", "ON_HOLD", "DROPPED"] },
        },
        ["projectId", "title", "problem"]
      ),
      "/api/mcp/save-story-state-snapshot": action(
        { operationId: "saveStoryStateSnapshot", text: "現在の物語状態のスナップショットを保存する" },
        {
          ...projectIdProp,
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
        ["projectId", "summary"]
      ),
      "/api/mcp/delete-project-data": action(
        { operationId: "deleteProjectData", text: "作品配下のデータを論理削除する(物理削除は行わない)" },
        {
          ...projectIdProp,
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
              "PLOT_THREAD",
              "REVISION_TODO",
              "STORY_STATE_SNAPSHOT",
            ],
          },
          targetId: { type: "string" },
          reason: { type: "string" },
        },
        ["projectId", "targetType"]
      ),
      "/api/mcp/rollback-command": action(
        { operationId: "rollbackCommand", text: "指定した保存・更新・削除操作を取り消す" },
        { ...projectIdProp, commandId: { type: "string" }, transactionId: { type: "string" }, force: { type: "boolean" } },
        ["projectId"]
      ),
      "/api/mcp/undo-last-command": action(
        { operationId: "undoLastCommand", text: "直前の操作を取り消す" },
        { ...projectIdProp, force: { type: "boolean" } },
        ["projectId"]
      ),
    },
  };

  return NextResponse.json(schema);
}
