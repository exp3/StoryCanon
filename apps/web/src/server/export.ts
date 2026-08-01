type ExportableNote = { title?: string | null; body: string; category?: string | null; importance?: string | null };

type ExportableProject = {
  title: string;
  genre?: string | null;
  premise?: string | null;
  tone?: string | null;
  targetAudience?: string | null;
  writingStyle?: string | null;
  forbiddenElements?: string | null;
  userPreferences?: string | null;
  chapters: Array<{ id: string; title: string; order: number; summary?: string | null; purpose?: string | null }>;
  scenes: Array<{
    chapterId?: string | null;
    title: string;
    order: number;
    body: string;
    summary?: string | null;
    occurredEvents?: string | null;
  }>;
  characters: Array<{
    name: string;
    role?: string | null;
    age?: string | null;
    personality?: string | null;
    speechStyle?: string | null;
    appearance?: string | null;
    background?: string | null;
    goal?: string | null;
    secret?: string | null;
    currentState?: string | null;
    notes?: ExportableNote[];
  }>;
  worldNotes: Array<{ title: string; body: string; category: string; importance?: string | null }>;
  foreshadowings: Array<{
    title: string;
    description: string;
    status: string;
    importance?: string | null;
    plannedResolution?: string | null;
  }>;
  mysteries: Array<{
    scope: string;
    question: string;
    truth?: string | null;
    knownBy?: string | null;
    clues?: string | null;
    revealPoint?: string | null;
  }>;
  plotThreads: Array<{
    title: string;
    description?: string | null;
    status: string;
    currentState?: string | null;
    resolutionCondition?: string | null;
  }>;
  revisionTodos: Array<{
    title: string;
    problem: string;
    status: string;
    priority?: string | null;
    suggestion?: string | null;
  }>;
  storyStateSnapshots: Array<{
    summary: string;
    recentEvents?: string | null;
    unresolvedProblems?: string | null;
    nextOptions?: string | null;
    createdAt: Date;
  }>;
};

export function renderMarkdown(project: ExportableProject) {
  const lines: string[] = [`# ${project.title}`, ""];

  lines.push("## Overview");
  pushField(lines, "Premise", project.premise);
  pushField(lines, "Genre", project.genre);
  pushField(lines, "Tone", project.tone);
  pushField(lines, "Target Audience", project.targetAudience);
  pushField(lines, "Writing Style", project.writingStyle);
  pushField(lines, "Forbidden Elements", project.forbiddenElements);
  pushField(lines, "User Preferences", project.userPreferences);
  lines.push("");

  lines.push("## Current Story State");
  const latest = project.storyStateSnapshots[0];
  if (latest) {
    lines.push(latest.summary);
    pushField(lines, "Recent Events", latest.recentEvents);
    pushField(lines, "Unresolved Problems", latest.unresolvedProblems);
    pushField(lines, "Next Options", latest.nextOptions);
  }
  lines.push("");

  lines.push("## Characters");
  for (const character of project.characters) {
    lines.push(`### ${character.name}${character.role ? ` (${character.role})` : ""}`);
    pushField(lines, "Age", character.age);
    pushField(lines, "Personality", character.personality);
    pushField(lines, "Speech Style", character.speechStyle);
    pushField(lines, "Appearance", character.appearance);
    pushField(lines, "Background", character.background);
    pushField(lines, "Goal", character.goal);
    pushField(lines, "Secret", character.secret);
    pushField(lines, "Current State", character.currentState);
    for (const note of character.notes ?? []) {
      lines.push(`- ${note.title ? `${note.title}: ` : ""}${note.body}`);
    }
    lines.push("");
  }

  lines.push("## World Notes");
  for (const note of project.worldNotes) {
    lines.push(`### ${note.title}`, note.body, "");
  }

  lines.push("## Foreshadowings");
  for (const item of project.foreshadowings) {
    lines.push(`- [${item.status}] ${item.title}: ${item.description}`);
    if (item.plannedResolution) lines.push(`  - Planned Resolution: ${item.plannedResolution}`);
  }
  lines.push("");

  lines.push("## Mysteries");
  for (const item of project.mysteries) {
    lines.push(`- [${item.scope}] ${item.question}`);
    if (item.truth) lines.push(`  - Truth: ${item.truth}`);
    if (item.knownBy) lines.push(`  - Known By: ${item.knownBy}`);
    if (item.clues) lines.push(`  - Clues: ${item.clues}`);
    if (item.revealPoint) lines.push(`  - Reveal Point: ${item.revealPoint}`);
  }
  lines.push("");

  lines.push("## Plot Threads");
  for (const thread of project.plotThreads) {
    lines.push(`- [${thread.status}] ${thread.title}${thread.description ? `: ${thread.description}` : ""}`);
    if (thread.currentState) lines.push(`  - Current State: ${thread.currentState}`);
    if (thread.resolutionCondition) lines.push(`  - Resolution Condition: ${thread.resolutionCondition}`);
  }
  lines.push("");

  lines.push("## Revision Todos");
  for (const todo of project.revisionTodos) {
    lines.push(`- [${todo.status}] ${todo.title}: ${todo.problem}`);
    if (todo.suggestion) lines.push(`  - Suggestion: ${todo.suggestion}`);
  }
  lines.push("");

  lines.push("## Manuscript");
  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order);
  for (const chapter of chapters) {
    lines.push("", `### ${chapter.title}`);
    if (chapter.summary) lines.push(`> ${chapter.summary}`);
    if (chapter.purpose) lines.push(`> Purpose: ${chapter.purpose}`);
    lines.push("");
    for (const scene of scenes.filter((item) => item.chapterId === chapter.id)) {
      lines.push(`#### ${scene.title}`, "");
      if (scene.summary) lines.push(`> ${scene.summary}`, "");
      lines.push(scene.body, "");
    }
  }
  for (const scene of scenes.filter((item) => !item.chapterId)) {
    lines.push("", `### ${scene.title}`, "");
    if (scene.summary) lines.push(`> ${scene.summary}`, "");
    lines.push(scene.body, "");
  }

  return lines.join("\n");
}

function pushField(lines: string[], label: string, value?: string | null) {
  if (value) lines.push(`- **${label}**: ${value}`);
}

type PlainTextLocale = "en" | "ja";

const plainTextLabels: Record<PlainTextLocale, Record<string, string>> = {
  ja: {
    overview: "【概要】",
    storyState: "【現在の物語状態】",
    characters: "【登場人物】",
    worldNotes: "【世界観メモ】",
    foreshadowings: "【伏線】",
    mysteries: "【ミステリー】",
    plotThreads: "【進行中プロット】",
    revisionTodos: "【修正TODO】",
    manuscript: "【本文】",
    premise: "前提",
    genre: "ジャンル",
    tone: "トーン",
    targetAudience: "想定読者",
    writingStyle: "文体",
    forbiddenElements: "禁止要素",
    userPreferences: "ユーザー設定",
    age: "年齢",
    personality: "性格",
    speechStyle: "口調",
    appearance: "外見",
    background: "背景",
    goal: "目標",
    secret: "秘密",
    currentState: "現在の状態",
    recentEvents: "最近の出来事",
    unresolvedProblems: "未解決の問題",
    nextOptions: "次の選択肢",
    summary: "要約",
    occurredEvents: "起きた出来事",
    purpose: "章の目的",
    plannedResolution: "回収予定",
    resolutionCondition: "回収条件",
    suggestion: "提案",
    truth: "真相",
    knownBy: "真相を知る人物",
    clues: "手がかり",
    revealPoint: "明かされる地点",
  },
  en: {
    overview: "[Overview]",
    storyState: "[Current Story State]",
    characters: "[Characters]",
    worldNotes: "[World Notes]",
    foreshadowings: "[Foreshadowings]",
    mysteries: "[Mysteries]",
    plotThreads: "[Plot Threads]",
    revisionTodos: "[Revision Todos]",
    manuscript: "[Manuscript]",
    premise: "Premise",
    genre: "Genre",
    tone: "Tone",
    targetAudience: "Target Audience",
    writingStyle: "Writing Style",
    forbiddenElements: "Forbidden Elements",
    userPreferences: "User Preferences",
    age: "Age",
    personality: "Personality",
    speechStyle: "Speech Style",
    appearance: "Appearance",
    background: "Background",
    goal: "Goal",
    secret: "Secret",
    currentState: "Current State",
    recentEvents: "Recent Events",
    unresolvedProblems: "Unresolved Problems",
    nextOptions: "Next Options",
    summary: "Summary",
    occurredEvents: "Occurred Events",
    purpose: "Purpose",
    plannedResolution: "Planned Resolution",
    resolutionCondition: "Resolution Condition",
    suggestion: "Suggestion",
    truth: "Truth",
    knownBy: "Known By",
    clues: "Clues",
    revealPoint: "Reveal Point",
  },
};

/**
 * Plain-text export of the whole project (no Markdown markup), suitable for
 * pasting into a manuscript or editor. Includes every textual field so it can
 * serve as a complete "copy everything" alternative to the per-field buttons.
 */
export function renderPlainText(project: ExportableProject, locale: PlainTextLocale = "ja") {
  const L = plainTextLabels[locale] ?? plainTextLabels.ja;
  const bullet = locale === "en" ? "- " : "・";
  const lines: string[] = [project.title, ""];

  const push = (label: string, value?: string | null, indent = "  ") => {
    if (value) lines.push(`${indent}${label}: ${value}`);
  };

  const overview: string[] = [];
  if (project.premise) overview.push(`${L.premise}: ${project.premise}`);
  if (project.genre) overview.push(`${L.genre}: ${project.genre}`);
  if (project.tone) overview.push(`${L.tone}: ${project.tone}`);
  if (project.targetAudience) overview.push(`${L.targetAudience}: ${project.targetAudience}`);
  if (project.writingStyle) overview.push(`${L.writingStyle}: ${project.writingStyle}`);
  if (project.forbiddenElements) overview.push(`${L.forbiddenElements}: ${project.forbiddenElements}`);
  if (project.userPreferences) overview.push(`${L.userPreferences}: ${project.userPreferences}`);
  if (overview.length > 0) lines.push(L.overview, ...overview, "");

  const latest = project.storyStateSnapshots[0];
  if (latest) {
    lines.push(L.storyState, latest.summary);
    push(L.recentEvents, latest.recentEvents, "");
    push(L.unresolvedProblems, latest.unresolvedProblems, "");
    push(L.nextOptions, latest.nextOptions, "");
    lines.push("");
  }

  if (project.characters.length > 0) {
    lines.push(L.characters);
    for (const character of project.characters) {
      lines.push(`${bullet}${character.name}${character.role ? ` (${character.role})` : ""}`);
      push(L.age, character.age);
      push(L.personality, character.personality);
      push(L.speechStyle, character.speechStyle);
      push(L.appearance, character.appearance);
      push(L.background, character.background);
      push(L.goal, character.goal);
      push(L.secret, character.secret);
      push(L.currentState, character.currentState);
      for (const note of character.notes ?? []) {
        lines.push(`  - ${note.title ? `${note.title}: ` : ""}${note.body}`);
      }
    }
    lines.push("");
  }

  if (project.worldNotes.length > 0) {
    lines.push(L.worldNotes);
    for (const note of project.worldNotes) {
      lines.push(note.title, note.body, "");
    }
  }

  if (project.foreshadowings.length > 0) {
    lines.push(L.foreshadowings);
    for (const item of project.foreshadowings) {
      lines.push(`${bullet}[${item.status}] ${item.title}: ${item.description}`);
      push(L.plannedResolution, item.plannedResolution);
    }
    lines.push("");
  }

  if (project.mysteries.length > 0) {
    lines.push(L.mysteries);
    for (const item of project.mysteries) {
      lines.push(`${bullet}[${item.scope}] ${item.question}`);
      push(L.truth, item.truth);
      push(L.knownBy, item.knownBy);
      push(L.clues, item.clues);
      push(L.revealPoint, item.revealPoint);
    }
    lines.push("");
  }

  if (project.plotThreads.length > 0) {
    lines.push(L.plotThreads);
    for (const thread of project.plotThreads) {
      lines.push(`${bullet}[${thread.status}] ${thread.title}${thread.description ? `: ${thread.description}` : ""}`);
      push(L.currentState, thread.currentState);
      push(L.resolutionCondition, thread.resolutionCondition);
    }
    lines.push("");
  }

  if (project.revisionTodos.length > 0) {
    lines.push(L.revisionTodos);
    for (const todo of project.revisionTodos) {
      lines.push(`${bullet}[${todo.status}] ${todo.title}: ${todo.problem}`);
      push(L.suggestion, todo.suggestion);
    }
    lines.push("");
  }

  lines.push(L.manuscript, "");
  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order);
  const pushScene = (scene: ExportableProject["scenes"][number]) => {
    lines.push(scene.title, "");
    if (scene.summary) lines.push(`(${L.summary}) ${scene.summary}`, "");
    if (scene.occurredEvents) lines.push(`(${L.occurredEvents}) ${scene.occurredEvents}`, "");
    lines.push(scene.body, "");
  };
  for (const chapter of chapters) {
    lines.push(chapter.title);
    if (chapter.summary) lines.push(`(${L.summary}) ${chapter.summary}`);
    if (chapter.purpose) lines.push(`(${L.purpose}) ${chapter.purpose}`);
    lines.push("");
    for (const scene of scenes.filter((item) => item.chapterId === chapter.id)) {
      pushScene(scene);
    }
  }
  for (const scene of scenes.filter((item) => !item.chapterId)) {
    pushScene(scene);
  }

  return lines.join("\n");
}
