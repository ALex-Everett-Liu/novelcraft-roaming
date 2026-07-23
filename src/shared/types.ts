import { z } from "zod";

// ===== Fragment =====
export const FragmentTypeEnum = z.enum([
  "scene",
  "dialogue",
  "plot",
  "lore",
  "synopsis",
  "note",
]);

export const FragmentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().default(""),
  content: z.string(),
  type: FragmentTypeEnum.default("scene"),
  tags: z.array(z.string()).default([]),
  order: z.number(),
  wordCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Fragment = z.infer<typeof FragmentSchema>;
export type FragmentType = z.infer<typeof FragmentTypeEnum>;

// ===== Chapter =====
export const ChapterSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().default(""),
  content: z.string(),
  sourceFragmentIds: z.array(z.string()),
  wordCount: z.number().default(0),
  createdAt: z.string(),
});

export type Chapter = z.infer<typeof ChapterSchema>;

// ===== Project =====
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

// ===== LLM Config =====
export const LLMConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.8),
  maxTokens: z.number().default(4096),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// ===== Agent =====
export const AgentModeEnum = z.enum([
  "polish",
  "bridge",
  "splice",
  "expand",
  "diverge",
  "continue",
  "complete",
  "workshop",
]);

export type AgentMode = z.infer<typeof AgentModeEnum>;

export const AgentRequestSchema = z.object({
  mode: AgentModeEnum,
  fragmentIds: z.array(z.string()).min(1),
  contextFragmentIds: z.array(z.string()).default([]),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

// ===== Workshop =====
export const WorkshopStageEnum = z.enum([
  "analyzing",
  "questions",
  "revising",
  "review",
]);

export type WorkshopStage = z.infer<typeof WorkshopStageEnum>;

export const CritiqueQuestionSchema = z.object({
  id: z.string(),
  section: z.string(),
  question: z.string(),
  userAnswer: z.string().default(""),
});

export type CritiqueQuestion = z.infer<typeof CritiqueQuestionSchema>;

export const WorkshopStateSchema = z.object({
  stage: WorkshopStageEnum,
  chapterFragmentId: z.string(),
  questions: z.array(CritiqueQuestionSchema).default([]),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "agent"]),
      content: z.string(),
    })
  ).default([]),
  revisedContent: z.string().default(""),
});

export type WorkshopState = z.infer<typeof WorkshopStateSchema>;

// ===== RPC Params =====
export interface CreateFragmentParams {
  projectId: string;
  title?: string;
  content: string;
  type?: FragmentType;
  order?: number;
}

export interface UpdateFragmentParams {
  id: string;
  title?: string;
  content?: string;
  type?: FragmentType;
  tags?: string[];
  order?: number;
}

export interface DeleteFragmentParams {
  id: string;
}

export interface ReorderFragmentsParams {
  orderedIds: string[];
}

export interface CreateChapterParams {
  projectId: string;
  title?: string;
  content: string;
  sourceFragmentIds: string[];
}

export interface CreateProjectParams {
  name: string;
}

export interface AgentRunParams {
  mode: AgentMode;
  fragmentIds: string[];
  contextFragmentIds?: string[];
}

export interface WorkshopStartParams {
  fragmentId: string;
}

export interface WorkshopAnswerParams {
  fragmentId: string;
  answers: { questionId: string; answer: string }[];
}

export interface WorkshopReviseParams {
  fragmentId: string;
}

export interface ImportTxtParams {
  projectId: string;
  content: string;
  delimiter?: string;
}

export interface SaveLLMConfigParams {
  config: LLMConfig;
}

// ===== RPC Result =====
export interface RpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===== Plugin Info (for settings UI) =====
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: "core" | "community";
  runtime: "main" | "renderer" | "both";
  essential: boolean;
  enabled: boolean;
  enabledByDefault: boolean;
  dependencies: string[];
}
