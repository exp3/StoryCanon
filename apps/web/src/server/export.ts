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
    "## Overview",
    project.premise ?? "",
    "",
    "## Current Story State",
    project.storyStateSnapshots[0]?.summary ?? "",
    "",
    "## Characters",
  ];

  for (const character of project.characters) {
    lines.push(`- ${character.name}${character.role ? `: ${character.role}` : ""}${character.currentState ? ` / ${character.currentState}` : ""}`);
  }

  lines.push("", "## World Notes");
  for (const note of project.worldNotes) {
    lines.push(`### ${note.title}`, note.body, "");
  }

  lines.push("## Foreshadowings");
  for (const item of project.foreshadowings) {
    lines.push(`- [${item.status}] ${item.title}: ${item.description}`);
  }

  lines.push("", "## Plot Threads");
  for (const thread of project.plotThreads) {
    lines.push(`- [${thread.status}] ${thread.title}${thread.description ? `: ${thread.description}` : ""}`);
  }

  lines.push("", "## Revision Todos");
  for (const todo of project.revisionTodos) {
    lines.push(`- [${todo.status}] ${todo.title}: ${todo.problem}`);
  }

  lines.push("", "## Manuscript");
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
