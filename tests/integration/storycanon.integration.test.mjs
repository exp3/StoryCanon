import assert from "node:assert/strict";
import test from "node:test";

const limits = {
  FREE: {
    projects: 3,
    charactersPerProject: 8,
    bodyCharsPerProject: 20000,
    worldNotesPerProject: 30,
    foreshadowingsPerProject: 30,
    plotThreadsPerProject: 30,
    revisionTodosPerProject: 50,
    storySnapshotsPerProject: 10,
  },
  PLUS: {
    projects: 50,
    charactersPerProject: 20,
    bodyCharsPerProject: 100000,
    worldNotesPerProject: 200,
    foreshadowingsPerProject: 100,
    plotThreadsPerProject: 100,
    revisionTodosPerProject: 300,
    storySnapshotsPerProject: 100,
  },
};

class MemoryStoryCanon {
  constructor() {
    this.ids = 0;
    this.users = new Map();
    this.projects = [];
    this.chapters = [];
    this.scenes = [];
    this.characters = [];
    this.characterNotes = [];
    this.worldNotes = [];
    this.foreshadowings = [];
    this.plotThreads = [];
    this.revisionTodos = [];
    this.snapshots = [];
  }

  id(prefix) {
    this.ids += 1;
    return `${prefix}_${this.ids}`;
  }

  plan(userId) {
    return this.users.get(userId)?.plan ?? "FREE";
  }

  setPlan(userId, plan) {
    this.users.set(userId, { plan });
  }

  assertLimit(userId, current, limitKey) {
    const limit = limits[this.plan(userId)][limitKey];
    if (current >= limit) {
      const error = new Error("PLAN_LIMIT_EXCEEDED");
      error.current = current;
      error.limit = limit;
      throw error;
    }
  }

  createProject(userId, input) {
    this.assertLimit(userId, this.projects.filter((item) => item.userId === userId).length, "projects");
    const project = { id: this.id("project"), userId, visibility: "PRIVATE", ...input, updatedAt: new Date() };
    this.projects.push(project);
    this.snapshots.push({ id: this.id("snapshot"), projectId: project.id, summary: input.premise ?? `${input.title} initial state`, createdAt: new Date() });
    return project;
  }

  requireProject(userId, projectId) {
    const project = this.projects.find((item) => item.id === projectId && item.userId === userId);
    if (!project) throw new Error("NOT_FOUND");
    return project;
  }

  saveGeneratedScene(userId, input) {
    const project = this.requireProject(userId, input.projectId);
    const currentChars = this.scenes.filter((item) => item.projectId === project.id).reduce((sum, scene) => sum + scene.body.length, 0);
    const bodyLimit = limits[this.plan(userId)].bodyCharsPerProject;
    if (currentChars + input.body.length > bodyLimit) {
      const error = new Error("PLAN_LIMIT_EXCEEDED");
      error.current = currentChars + input.body.length;
      error.limit = bodyLimit;
      throw error;
    }

    let chapter = this.chapters.find((item) => item.projectId === project.id && item.title === input.chapterTitle);
    if (!chapter) {
      chapter = { id: this.id("chapter"), projectId: project.id, title: input.chapterTitle, order: this.chapters.length };
      this.chapters.push(chapter);
    }
    const scene = {
      id: this.id("scene"),
      projectId: project.id,
      chapterId: chapter.id,
      title: input.sceneTitle,
      body: input.body,
      summary: input.summary,
      createdBy: "CHATGPT",
      order: this.scenes.length,
    };
    this.scenes.push(scene);
    return scene;
  }

  saveCharacterNote(userId, input) {
    const project = this.requireProject(userId, input.projectId);
    let character = this.characters.find((item) => item.projectId === project.id && item.name === input.characterName);
    if (!character) {
      this.assertLimit(userId, this.characters.filter((item) => item.projectId === project.id).length, "charactersPerProject");
      character = { id: this.id("character"), projectId: project.id, name: input.characterName };
      this.characters.push(character);
    }
    const note = { id: this.id("characterNote"), projectId: project.id, characterId: character.id, body: input.body, importance: input.importance ?? "MEDIUM" };
    this.characterNotes.push(note);
    return { character, note };
  }

  context(userId, projectId) {
    const project = this.requireProject(userId, projectId);
    return {
      project: { id: project.id, title: project.title, genre: project.genre, premise: project.premise, tone: project.tone },
      latestStoryState: this.snapshots.filter((item) => item.projectId === projectId).at(-1),
      characters: this.characters.filter((item) => item.projectId === projectId),
      activePlotThreads: this.plotThreads.filter((item) => item.projectId === projectId && item.status !== "RESOLVED"),
      unresolvedForeshadowings: this.foreshadowings.filter((item) => item.projectId === projectId && item.status !== "RESOLVED"),
    };
  }

  markdown(userId, projectId) {
    const project = this.requireProject(userId, projectId);
    const scenes = this.scenes.filter((item) => item.projectId === projectId);
    return [`# ${project.title}`, "", "## 本文", ...scenes.flatMap((scene) => [`### ${scene.title}`, scene.body])].join("\n");
  }
}

test("ChatGPT連携想定の作品作成、本文保存、文脈取得、Markdown出力がつながる", () => {
  const app = new MemoryStoryCanon();
  const project = app.createProject("user-1", {
    title: "火星補給ステーション",
    genre: "近未来SF",
    premise: "補給拠点の異常から始まる危機対応SF",
    tone: "淡々とした緊張感",
  });

  const scene = app.saveGeneratedScene("user-1", {
    projectId: project.id,
    chapterTitle: "第1章",
    sceneTitle: "燃料輸送路の異常",
    body: "圧力センサーが、誰も見ていない時間だけ低い値を示していた。",
    summary: "補給路の異常が発見される。",
  });

  const { character } = app.saveCharacterNote("user-1", {
    projectId: project.id,
    characterName: "通信士",
    body: "孤独を恐れながらも冷静に振る舞う。",
    importance: "HIGH",
  });

  const context = app.context("user-1", project.id);
  assert.equal(scene.createdBy, "CHATGPT");
  assert.equal(context.project.title, "火星補給ステーション");
  assert.equal(context.characters[0].id, character.id);
  assert.match(app.markdown("user-1", project.id), /燃料輸送路の異常/);
});

test("所有者以外は作品文脈を取得できない", () => {
  const app = new MemoryStoryCanon();
  const project = app.createProject("owner", { title: "Private Canon" });
  assert.throws(() => app.context("other-user", project.id), /NOT_FOUND/);
});

test("Freeプランの作品数制限を超えた保存は拒否される", () => {
  const app = new MemoryStoryCanon();
  app.createProject("free-user", { title: "one" });
  app.createProject("free-user", { title: "two" });
  app.createProject("free-user", { title: "three" });
  assert.throws(() => app.createProject("free-user", { title: "four" }), /PLAN_LIMIT_EXCEEDED/);
});
