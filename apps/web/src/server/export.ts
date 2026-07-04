type ExportableProject = {
  title: string;
  genre?: string | null;
  premise?: string | null;
  tone?: string | null;
  chapters: Array<{ id: string; title: string; order: number; summary?: string | null }>;
  scenes: Array<{ chapterId?: string | null; title: string; order: number; body: string; summary?: string | null }>;
  characters: Array<{ name: string; role?: string | null; currentState?: string | null }>;
  worldNotes: Array<{ title: string; body: string; category: string }>;
  foreshadowings: Array<{ title: string; description: string; status: string }>;
  plotThreads: Array<{ title: string; description?: string | null; status: string }>;
  revisionTodos: Array<{ title: string; problem: string; status: string }>;
  storyStateSnapshots: Array<{ summary: string; createdAt: Date }>;
};

export function renderMarkdown(project: ExportableProject) {
  const lines: string[] = [
    `# ${project.title}`,
    "",
    "## 概要",
    project.premise ?? "",
    "",
    "## 現在のストーリー状態",
    project.storyStateSnapshots[0]?.summary ?? "",
    "",
    "## キャラクター",
  ];

  for (const character of project.characters) {
    lines.push(`- ${character.name}${character.role ? `: ${character.role}` : ""}${character.currentState ? ` / ${character.currentState}` : ""}`);
  }

  lines.push("", "## 世界観メモ");
  for (const note of project.worldNotes) {
    lines.push(`### ${note.title}`, note.body, "");
  }

  lines.push("## 伏線");
  for (const item of project.foreshadowings) {
    lines.push(`- [${item.status}] ${item.title}: ${item.description}`);
  }

  lines.push("", "## プロットスレッド");
  for (const thread of project.plotThreads) {
    lines.push(`- [${thread.status}] ${thread.title}${thread.description ? `: ${thread.description}` : ""}`);
  }

  lines.push("", "## 修正TODO");
  for (const todo of project.revisionTodos) {
    lines.push(`- [${todo.status}] ${todo.title}: ${todo.problem}`);
  }

  lines.push("", "## 本文");
  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order);
  for (const chapter of chapters) {
    lines.push("", `### ${chapter.title}`, "");
    for (const scene of scenes.filter((item) => item.chapterId === chapter.id)) {
      lines.push(`#### ${scene.title}`, "", scene.body, "");
    }
  }
  for (const scene of scenes.filter((item) => !item.chapterId)) {
    lines.push("", `### ${scene.title}`, "", scene.body, "");
  }

  return lines.join("\n");
}
