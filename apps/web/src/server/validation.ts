import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().min(1).max(120),
  genre: z.string().max(80).optional(),
  premise: z.string().max(5000).optional(),
  tone: z.string().max(1000).optional(),
  targetAudience: z.string().max(1000).optional(),
  writingStyle: z.string().max(2000).optional(),
  forbiddenElements: z.string().max(2000).optional(),
  userPreferences: z.string().max(2000).optional(),
});

export const createChapterSchema = z.object({
  title: z.string().min(1).max(120),
  order: z.number().int().nonnegative().optional(),
  summary: z.string().max(5000).optional(),
  purpose: z.string().max(2000).optional(),
});

export const createSceneSchema = z.object({
  chapterId: z.string().optional(),
  title: z.string().min(1).max(160),
  order: z.number().int().nonnegative().optional(),
  body: z.string().max(50000),
  summary: z.string().max(5000).optional(),
  occurredEvents: z.string().max(5000).optional(),
  generationPrompt: z.string().max(10000).optional(),
  createdBy: z.enum(["USER", "CHATGPT"]).default("USER"),
});

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(120).optional(),
  age: z.string().max(80).optional(),
  personality: z.string().max(2000).optional(),
  speechStyle: z.string().max(2000).optional(),
  appearance: z.string().max(2000).optional(),
  background: z.string().max(5000).optional(),
  goal: z.string().max(2000).optional(),
  secret: z.string().max(2000).optional(),
  currentState: z.string().max(5000).optional(),
});

export const createCharacterNoteSchema = z.object({
  characterId: z.string().optional(),
  characterName: z.string().min(1).max(120).optional(),
  title: z.string().max(160).optional(),
  body: z.string().min(1).max(20000),
  category: z.enum(["INNER", "RELATIONSHIP", "BACKGROUND", "SPEECH", "PLOT", "OTHER"]).optional(),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  relatedSceneId: z.string().optional(),
});

export const createWorldNoteSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(20000),
  category: z.enum(["PLACE", "ORGANIZATION", "TECHNOLOGY", "HISTORY", "CULTURE", "ITEM", "RULE", "OTHER"]).default("OTHER"),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  relatedSceneId: z.string().optional(),
});

export const createForeshadowingSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(10000),
  plantedSceneId: z.string().optional(),
  plannedResolution: z.string().max(5000).optional(),
  resolvedSceneId: z.string().optional(),
  status: z.enum(["UNPLANTED", "PLANTED", "IN_PROGRESS", "RESOLVED", "DROPPED"]).default("UNPLANTED"),
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export const createPlotThreadSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(10000).optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "DROPPED"]).default("NOT_STARTED"),
  startSceneId: z.string().optional(),
  currentState: z.string().max(5000).optional(),
  resolutionCondition: z.string().max(5000).optional(),
});

export const createRevisionTodoSchema = z.object({
  chapterId: z.string().optional(),
  sceneId: z.string().optional(),
  title: z.string().min(1).max(160),
  problem: z.string().min(1).max(10000),
  suggestion: z.string().max(10000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "ON_HOLD", "DROPPED"]).default("OPEN"),
  source: z.enum(["USER", "CHATGPT"]).default("USER"),
});

export const createStoryStateSnapshotSchema = z.object({
  summary: z.string().min(1).max(20000),
  recentEvents: z.string().max(20000).optional(),
  characterStates: z.string().max(20000).optional(),
  unresolvedProblems: z.string().max(20000).optional(),
  unresolvedForeshadowings: z.string().max(20000).optional(),
  activePlotThreads: z.string().max(20000).optional(),
  nextOptions: z.string().max(20000).optional(),
  avoidElements: z.string().max(10000).optional(),
  writingRules: z.string().max(10000).optional(),
  userPreferences: z.string().max(10000).optional(),
});
