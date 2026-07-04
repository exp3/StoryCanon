import assert from "node:assert/strict";
import test from "node:test";

const limits = {
  FREE: { projects: 3, bodyCharsPerProject: 20000 },
  PLUS: { projects: 50, bodyCharsPerProject: 100000 },
  PRO: { projects: Infinity, bodyCharsPerProject: Infinity },
};

class MemoryStoryCanon {
  constructor() {
    this.ids = 0;
    this.users = new Map();
    this.projects = [];
    this.scenes = [];
    this.mutationLogs = [];
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

  active(items) {
    return items.filter((item) => item.deletedAt == null);
  }

  command(action, userId, projectId, targetType, targetId, beforeSnapshot, afterSnapshot, transactionId) {
    const log = {
      id: this.id("log"),
      commandId: this.id("cmd"),
      transactionId,
      userId,
      projectId,
      action,
      targetType,
      targetId,
      beforeSnapshot: beforeSnapshot ? structuredClone(beforeSnapshot) : null,
      afterSnapshot: afterSnapshot ? structuredClone(afterSnapshot) : null,
      rolledBackAt: null,
      createdAt: new Date(this.ids),
    };
    this.mutationLogs.push(log);
    return log;
  }

  createProject(userId, input) {
    const current = this.active(this.projects).filter((item) => item.userId === userId).length;
    if (current >= limits[this.plan(userId)].projects) throw new Error("PLAN_LIMIT_EXCEEDED");
    const project = { id: this.id("project"), userId, visibility: "PRIVATE", deletedAt: null, ...input, updatedAt: new Date() };
    this.projects.push(project);
    this.command("CREATE", userId, project.id, "PROJECT", project.id, null, project);
    return project;
  }

  requireProject(userId, projectId) {
    const project = this.projects.find((item) => item.id === projectId && item.userId === userId && item.deletedAt == null);
    if (!project) throw new Error("NOT_FOUND");
    return project;
  }

  saveGeneratedScene(userId, input) {
    const project = this.requireProject(userId, input.projectId);
    const currentChars = this.active(this.scenes).filter((item) => item.projectId === project.id).reduce((sum, scene) => sum + scene.body.length, 0);
    if (currentChars + input.body.length > limits[this.plan(userId)].bodyCharsPerProject) throw new Error("PLAN_LIMIT_EXCEEDED");
    const scene = {
      id: this.id("scene"),
      projectId: project.id,
      title: input.sceneTitle,
      body: input.body,
      summary: input.summary,
      createdBy: "CHATGPT",
      deletedAt: null,
      updatedAt: new Date(),
    };
    this.scenes.push(scene);
    const log = this.command("CREATE", userId, project.id, "SCENE", scene.id, null, scene, input.transactionId);
    return { scene, commandId: log.commandId, transactionId: log.transactionId };
  }

  updateScene(userId, sceneId, patch) {
    const scene = this.scenes.find((item) => item.id === sceneId && item.deletedAt == null);
    this.requireProject(userId, scene?.projectId);
    const before = structuredClone(scene);
    Object.assign(scene, patch, { updatedAt: new Date() });
    const log = this.command("UPDATE", userId, scene.projectId, "SCENE", scene.id, before, scene);
    return { scene, commandId: log.commandId };
  }

  deleteProjectData(userId, { projectId, targetType, targetId }) {
    this.requireProject(userId, projectId);
    const collection = targetType === "PROJECT" ? this.projects : this.scenes;
    const target = collection.find((item) => item.id === targetId && item.deletedAt == null);
    if (!target) throw new Error("NOT_FOUND");
    const before = structuredClone(target);
    target.deletedAt = new Date();
    const log = this.command("DELETE", userId, projectId, targetType, targetId, before, target);
    return { undoToken: log.commandId };
  }

  context(userId, projectId) {
    const project = this.requireProject(userId, projectId);
    return {
      project: { id: project.id, title: project.title },
      scenes: this.active(this.scenes).filter((item) => item.projectId === projectId),
    };
  }

  exportJson(userId, projectId) {
    if (this.plan(userId) === "FREE") throw new Error("PLAN_LIMIT_EXCEEDED");
    this.requireProject(userId, projectId);
    return { scenes: this.active(this.scenes).filter((item) => item.projectId === projectId) };
  }

  rollback(userId, { projectId, commandId, transactionId, force = false } = {}) {
    this.requireProject(userId, projectId);
    let logs = [];
    if (transactionId) {
      logs = this.mutationLogs.filter((item) => item.userId === userId && item.projectId === projectId && item.transactionId === transactionId && !item.rolledBackAt).reverse();
    } else if (commandId) {
      logs = this.mutationLogs.filter((item) => item.userId === userId && item.projectId === projectId && item.commandId === commandId && !item.rolledBackAt);
    } else {
      logs = this.mutationLogs.filter((item) => item.userId === userId && item.projectId === projectId && !item.rolledBackAt).slice(-1);
    }
    if (logs.length === 0) throw new Error("NOT_FOUND");

    for (const log of logs) {
      const later = this.mutationLogs.find((item) => item.targetType === log.targetType && item.targetId === log.targetId && item.createdAt > log.createdAt && !item.rolledBackAt && item.action !== "ROLLBACK");
      if (later && !force) throw new Error("ROLLBACK_CONFLICT");
      const collection = log.targetType === "PROJECT" ? this.projects : this.scenes;
      const target = collection.find((item) => item.id === log.targetId);
      if (log.action === "CREATE") target.deletedAt = new Date();
      if (log.action === "DELETE") target.deletedAt = null;
      if (log.action === "UPDATE") Object.assign(target, structuredClone(log.beforeSnapshot));
      log.rolledBackAt = new Date();
      this.command("ROLLBACK", userId, projectId, log.targetType, log.targetId, null, structuredClone(target));
    }
    return { rolledBackCommandIds: logs.map((item) => item.commandId) };
  }
}

test("MCP-style save, context, and owner checks work against active private data", () => {
  const app = new MemoryStoryCanon();
  const project = app.createProject("user-1", { title: "Private Canon" });
  const { scene } = app.saveGeneratedScene("user-1", {
    projectId: project.id,
    sceneTitle: "Opening Scene",
    body: "The generated manuscript text is stored as project data.",
    summary: "Opening summary",
  });

  assert.equal(scene.createdBy, "CHATGPT");
  assert.equal(app.context("user-1", project.id).scenes.length, 1);
  assert.throws(() => app.context("other-user", project.id), /NOT_FOUND/);
});

test("soft-deleted data is excluded from context and JSON export", () => {
  const app = new MemoryStoryCanon();
  app.setPlan("plus-user", "PLUS");
  const project = app.createProject("plus-user", { title: "Exportable Canon" });
  const { scene } = app.saveGeneratedScene("plus-user", { projectId: project.id, sceneTitle: "Scene", body: "body" });

  app.deleteProjectData("plus-user", { projectId: project.id, targetType: "SCENE", targetId: scene.id });

  assert.equal(app.context("plus-user", project.id).scenes.length, 0);
  assert.equal(app.exportJson("plus-user", project.id).scenes.length, 0);
});

test("JSON export is restricted to Plus or higher", () => {
  const app = new MemoryStoryCanon();
  const freeProject = app.createProject("free-user", { title: "Free Canon" });
  assert.throws(() => app.exportJson("free-user", freeProject.id), /PLAN_LIMIT_EXCEEDED/);

  app.setPlan("plus-user", "PLUS");
  const plusProject = app.createProject("plus-user", { title: "Plus Canon" });
  assert.deepEqual(app.exportJson("plus-user", plusProject.id), { scenes: [] });
});

test("rollback supports create deletion, delete restore, update restore, undo alias, and conflicts", () => {
  const app = new MemoryStoryCanon();
  const project = app.createProject("user-1", { title: "Rollback Canon" });
  const created = app.saveGeneratedScene("user-1", { projectId: project.id, sceneTitle: "Draft", body: "v1" });

  app.rollback("user-1", { projectId: project.id, commandId: created.commandId });
  assert.equal(app.context("user-1", project.id).scenes.length, 0);

  const second = app.saveGeneratedScene("user-1", { projectId: project.id, sceneTitle: "Draft 2", body: "v1" });
  const deleted = app.deleteProjectData("user-1", { projectId: project.id, targetType: "SCENE", targetId: second.scene.id });
  app.rollback("user-1", { projectId: project.id, commandId: deleted.undoToken });
  assert.equal(app.context("user-1", project.id).scenes.length, 1);

  const update = app.updateScene("user-1", second.scene.id, { body: "v2" });
  app.rollback("user-1", { projectId: project.id });
  assert.equal(app.context("user-1", project.id).scenes[0].body, "v1");

  const oldUpdate = app.updateScene("user-1", second.scene.id, { body: "v2" });
  app.updateScene("user-1", second.scene.id, { body: "v3" });
  assert.throws(() => app.rollback("user-1", { projectId: project.id, commandId: oldUpdate.commandId }), /ROLLBACK_CONFLICT/);
  app.rollback("user-1", { projectId: project.id, commandId: oldUpdate.commandId, force: true });
  assert.equal(app.context("user-1", project.id).scenes[0].body, "v1");
});

test("transaction rollback runs commands in reverse order", () => {
  const app = new MemoryStoryCanon();
  const project = app.createProject("user-1", { title: "Transaction Canon" });
  const transactionId = "tx-1";
  app.saveGeneratedScene("user-1", { projectId: project.id, sceneTitle: "One", body: "1", transactionId });
  app.saveGeneratedScene("user-1", { projectId: project.id, sceneTitle: "Two", body: "2", transactionId });

  const result = app.rollback("user-1", { projectId: project.id, transactionId });

  assert.equal(app.context("user-1", project.id).scenes.length, 0);
  assert.equal(result.rolledBackCommandIds.length, 2);
});
