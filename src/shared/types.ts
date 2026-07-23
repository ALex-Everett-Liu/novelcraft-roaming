import { z } from "zod";

// ===== Novel Profile =====
export const NovelProfileSchema = z.object({
  title: z.string().default(""),
  author: z.string().default(""),
  protagonist: z.string().default(""),
  synopsis: z.string().default(""),
  worldSetting: z.string().default(""),
  writingStyle: z.string().default(""),
});

export type NovelProfile = z.infer<typeof NovelProfileSchema>;

// ===== Protagonist Profile (14-dim psychology archive) =====
export const ProtagonistProfileSchema = z.object({
  basicAnchors: z.record(z.any()).default({}),
  personalitySystem: z.record(z.any()).default({}),
  motivationSystem: z.record(z.any()).default({}),
  emotionDefense: z.record(z.any()).default({}),
  behaviorFingerprint: z.record(z.any()).default({}),
  relationshipCoordinate: z.record(z.any()).default({}),
  growthArc: z.record(z.any()).default({}),
  oocRedlines: z.record(z.any()).default({}),
  epistemicState: z.record(z.any()).default({}),
  narrativeVoice: z.record(z.any()).default({}),
  worldInteraction: z.record(z.any()).default({}),
  culturalScripts: z.record(z.any()).default({}),
  selfContradictions: z.record(z.any()).default({}),
  embodiedExperience: z.record(z.any()).default({}),
  extractedAt: z.string().nullable().default(null),
  sourceChapterRange: z.tuple([z.number(), z.number()]).nullable().default(null),
});

export type ProtagonistProfile = z.infer<typeof ProtagonistProfileSchema>;

// ===== World Ontology (7-dim world-building meta-description) =====
export const WorldOntologySchema = z.object({
  existentialTopology: z.record(z.any()).default({}),
  causalArchitecture: z.record(z.any()).default({}),
  spatioTemporalOntology: z.record(z.any()).default({}),
  informationEpistemology: z.record(z.any()).default({}),
  axiologicalFoundation: z.record(z.any()).default({}),
  becomingDynamics: z.record(z.any()).default({}),
  narrativeOntology: z.record(z.any()).default({}),
  extractedAt: z.string().nullable().default(null),
  sourceChapterRange: z.tuple([z.number(), z.number()]).nullable().default(null),
});

export type WorldOntology = z.infer<typeof WorldOntologySchema>;

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
  novelProfile: NovelProfileSchema.nullable().default(null),
  protagonistProfile: ProtagonistProfileSchema.nullable().default(null),
  worldOntology: WorldOntologySchema.nullable().default(null),
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
  "discussing",
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
  segments: z.array(z.string()).default([]),
  currentSegmentIndex: z.number().default(0),
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
  segmentText?: string;
  segmentIndex?: number;
  totalSegments?: number;
}

export interface WorkshopAnswerParams {
  fragmentId: string;
  answers: { questionId: string; answer: string }[];
  questions: { id: string; question: string }[];
  history: { role: string; content: string }[];
}

export interface WorkshopReviseParams {
  fragmentId: string;
  discussion: string;
}

export interface ImportTxtParams {
  projectId: string;
  content: string;
  delimiter?: string;
}

export interface SaveLLMConfigParams {
  config: LLMConfig;
}

// ===== Extraction Params =====
export interface ProtagonistExtractParams {
  projectId: string;
  fragmentIds?: string[];
  lookback?: number;
}

export interface WorldOntologyExtractParams {
  projectId: string;
  fragmentIds?: string[];
  lookback?: number;
}

export interface BridgeExtractParams {
  projectId: string;
}

export interface NovelProfileSaveParams {
  projectId: string;
  novelProfile: NovelProfile;
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
