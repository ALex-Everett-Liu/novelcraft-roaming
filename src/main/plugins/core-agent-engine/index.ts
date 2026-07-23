import type { MainPlugin } from "../../plugin-system/PluginManifest";
import type { MainPluginContext } from "../../plugin-system/PluginManifest";
import { manifest } from "./manifest";
import { streamLLM } from "../core-llm-client/index";
import { PROMPTS } from "./prompts";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { getDataDir } from "../../database/connection";

const llmLogs: { ts: string; mode: string; system: string; user: string; response: string }[] = [];

interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface Fragment {
  id: string;
  projectId: string;
  title: string;
  content: string;
  type: string;
  tags: string[];
  order: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

type AgentMode = "polish" | "bridge" | "splice" | "expand" | "diverge" | "continue" | "complete" | "workshop";

function getConfig(ctx: MainPluginContext): LLMConfig | null {
  try {
    const configPath = path.join(getDataDir(), "config.json");
    if (existsSync(configPath)) {
      const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
      return {
        baseUrl: cfg.llm?.baseUrl || "https://api.deepseek.com",
        apiKey: cfg.llm?.apiKey || "",
        model: cfg.llm?.model || "deepseek-chat",
        temperature: cfg.llm?.temperature ?? 0.8,
        maxTokens: cfg.llm?.maxTokens ?? 16384,
      };
    }
  } catch {}
  return null;
}

function loadFragments(ctx: MainPluginContext, ids: string[]): Fragment[] {
  if (ids.length === 0) return [];
  const db = ctx.getDatabase();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db.query(`SELECT * FROM fragments WHERE id IN (${placeholders})`).all(...ids) as any[];
  return rows.map((r: any) => ({
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    content: r.content,
    type: r.type,
    tags: JSON.parse(r.tags),
    order: r.sort_order,
    wordCount: r.word_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

const plugin: MainPlugin = {
  manifest,

  async onLoad(ctx: MainPluginContext) {
    const activeRequests = new Map<string, AbortController>();

    ctx.registerRpcHandler("agentRun", async (params: {
      mode: AgentMode;
      fragmentIds: string[];
      contextFragmentIds?: string[];
    }) => {
      const config = getConfig(ctx);
      if (!config || !config.apiKey) {
        return { success: false, error: "LLM not configured. Please set your API key in Settings." };
      }

      const fragments = loadFragments(ctx, params.fragmentIds);
      if (fragments.length === 0) {
        return { success: false, error: "No fragments selected" };
      }

      const controller = new AbortController();
      const requestId = params.fragmentIds.join(",");
      activeRequests.set(requestId, controller);

      const send = (channel: string, payload: any) => ctx.sendMessage(channel, payload);

      // Build prompt based on mode
      let messages: { role: string; content: string }[];

      switch (params.mode) {
        case "polish": {
          const prompt = PROMPTS.polish.replace("{{fragment}}", fragments[0].content);
          messages = [
            { role: "system", content: "You are a professional literary editor." },
            { role: "user", content: prompt },
          ];
          break;
        }
        case "bridge": {
          if (fragments.length < 2) {
            return { success: false, error: "Bridge mode requires exactly 2 fragments" };
          }
          let prompt = PROMPTS.bridge;
          prompt = prompt.replace("{{fragmentA}}", fragments[0].content);
          prompt = prompt.replace("{{fragmentB}}", fragments[1].content);
          messages = [
            { role: "system", content: "You are a professional novelist." },
            { role: "user", content: prompt },
          ];
          break;
        }
        case "splice": {
          let fragmentText = "";
          fragments.forEach((f, i) => {
            fragmentText += `碎片 ${i + 1}：\n${f.content}\n\n`;
          });
          const prompt = PROMPTS.splice.replace("{{fragmentList}}", fragmentText.trim());
          messages = [
            { role: "system", content: "You are a novel integration editor." },
            { role: "user", content: prompt },
          ];
          break;
        }
        case "expand": {
          const prompt = PROMPTS.expand.replace("{{fragment}}", fragments[0].content);
          messages = [
            { role: "system", content: "You are a novelist." },
            { role: "user", content: prompt },
          ];
          break;
        }
        case "diverge": {
          let fragmentText = "";
          fragments.forEach((f) => {
            fragmentText += f.content + "\n\n";
          });
          const prompt = PROMPTS.diverge.replace("{{fragmentList}}", fragmentText.trim());
          messages = [
            { role: "system", content: "You are a creative writing assistant. Return ONLY valid JSON." },
            { role: "user", content: prompt },
          ];
          break;
        }
        case "continue": {
          let fragmentText = "";
          fragments.forEach((f) => {
            fragmentText += f.content + "\n\n";
          });
          const prompt = PROMPTS.continue.replace("{{fragmentList}}", fragmentText.trim());
          messages = [
            { role: "system", content: "You are a professional novelist." },
            { role: "user", content: prompt },
          ];
          break;
        }
        case "complete": {
          const prompt = PROMPTS.complete.replace("{{synopsis}}", fragments[0].content);
          messages = [
            { role: "system", content: "You are a senior novelist." },
            { role: "user", content: prompt },
          ];
          break;
        }
        case "workshop": {
          // Workshop mode — handled by workshopStart + workshopAnswer + workshopRevise flow
          return { success: false, error: "Workshop mode must be started via workshopStart" };
        }
        default:
          return { success: false, error: `Unknown agent mode: ${params.mode}` };
      }

      // Start streaming
      llmLogs.push({ ts: new Date().toISOString(), mode: params.mode, system: messages[0]?.content || "", user: messages[1]?.content || "", response: "" });
      const logIdx = llmLogs.length - 1;
      let fullResponse = "";
      streamLLM({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        messages,
        signal: controller.signal,
        onChunk: (chunk) => { fullResponse += chunk; send("streamChunk", { content: chunk }); },
        onDone: (fullText) => {
          llmLogs[logIdx].response = fullResponse || fullText;
          send("streamDone", { fullText });
        },
        onError: (message, code) => {
          llmLogs[logIdx].response = `ERROR: ${message}`;
          send("streamError", { message, code });
        },
      }).finally(() => {
        activeRequests.delete(requestId);
      });

      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("agentCancel", () => {
      for (const [, controller] of activeRequests) {
        controller.abort();
      }
      activeRequests.clear();
      return { success: true };
    }, { noPrefix: true });

    // ─── Workshop ─────────────────────────────
    ctx.registerRpcHandler("workshopStart", async (params: {
      fragmentId: string;
      segmentText?: string;
      segmentIndex?: number;
      totalSegments?: number;
    }) => {
      const config = getConfig(ctx);
      if (!config || !config.apiKey) {
        return { success: false, error: "LLM not configured" };
      }

      const fragments = loadFragments(ctx, [params.fragmentId]);
      if (fragments.length === 0) {
        return { success: false, error: "Fragment not found" };
      }

      const fragment = fragments[0];
      const content = params.segmentText || fragment.content;
      if (!content.trim()) {
        return { success: false, error: "No content to analyze" };
      }

      const send = (channel: string, payload: any) => ctx.sendMessage(channel, payload);

      // Send immediate progress feedback
      send("streamChunk", { content: "Analyzing your text and generating critique questions...\n\n" });

      const controller = new AbortController();
      activeRequests.set("workshop_" + params.fragmentId, controller);

      let fullText = "";
      const prompt = PROMPTS.workshopAnalyze.replace("{{chapter}}", content);
      console.log("[agent] workshopStart: content length =", content.length, "chars, sending to", config.model);
      llmLogs.push({ ts: new Date().toISOString(), mode: "workshop-analyze", system: "writing workshop mentor", user: content, response: "" });
      const logIdx = llmLogs.length - 1;

      streamLLM({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: 0.3, // analysis needs focus, not creativity
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: "You are a strict writing workshop mentor. Return ONLY valid JSON." },
          { role: "user", content: prompt },
        ],
        signal: controller.signal,
        onChunk: (chunk) => { fullText += chunk; },
        onDone: () => {
          console.log("[agent] workshopStart: LLM done, fullText.length =", fullText.length);
          if (llmLogs[logIdx]) llmLogs[logIdx].response = fullText;
          try {
            const jsonMatch = fullText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              try {
                const questions = JSON.parse(jsonMatch[0]);
                console.log("[agent] workshopStart: parsed", questions.length, "questions");
                const state = {
                  stage: "questions",
                  chapterFragmentId: params.fragmentId,
                  questions: questions.map((q: any) => ({
                    id: q.id,
                    section: q.section,
                    question: q.question,
                    userAnswer: "",
                  })),
                  conversationHistory: [],
                  revisedContent: "",
                };
                console.log("[agent] workshopStart: sending workshopStateChanged to renderer");
                send("workshopStateChanged", state);
              } catch (parseErr: any) {
                // JSON was found but incomplete — send as discussion text instead
                console.log("[agent] workshopStart: incomplete JSON, falling back to discussion text");
                const state = {
                  stage: "discussing",
                  chapterFragmentId: params.fragmentId,
                  questions: [],
                  conversationHistory: [
                    { role: "agent" as const, content: fullText },
                  ],
                  revisedContent: "",
                };
                send("workshopStateChanged", state);
              }
            } else {
              // No JSON at all — send raw response as discussion
              console.log("[agent] workshopStart: no JSON, sending as discussion text");
              const state = {
                stage: "discussing",
                chapterFragmentId: params.fragmentId,
                questions: [],
                conversationHistory: [
                  { role: "agent" as const, content: fullText },
                ],
                revisedContent: "",
              };
              send("workshopStateChanged", state);
            }
          } catch (e: any) {
            console.error("[agent] workshopStart: error:", e.message);
            send("streamError", { message: e.message });
          }
          activeRequests.delete("workshop_" + params.fragmentId);
        },
        onError: (message, code) => {
          console.error("[agent] workshopStart: LLM ERROR:", message, code);
          if (llmLogs[logIdx]) llmLogs[logIdx].response = `ERROR: ${message}`;
          send("streamError", { message, code });
          activeRequests.delete("workshop_" + params.fragmentId);
        },
      });

      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("workshopAnswer", async (params: {
      fragmentId: string;
      answers: { questionId: string; answer: string }[];
      questions: { id: string; question: string }[];
      history: { role: string; content: string }[];
    }) => {
      const config = getConfig(ctx);
      if (!config || !config.apiKey) {
        return { success: false, error: "LLM not configured" };
      }

      const fragments = loadFragments(ctx, [params.fragmentId]);
      if (fragments.length === 0) {
        return { success: false, error: "Fragment not found" };
      }

      const send = (channel: string, payload: any) => ctx.sendMessage(channel, payload);
      const controller = new AbortController();
      activeRequests.set("workshop_answer_" + params.fragmentId, controller);

      // Build the answers text from this round
      const answersText = params.questions
        .map((q, i) => `问：${q.question}\n答：${params.answers[i]?.answer || "(未回答)"}`)
        .join("\n\n");

      // Build discussion history text
      const historyText = params.history
        .map((h) => `${h.role === "agent" ? "导师" : "作者"}：${h.content}`)
        .join("\n\n");

      let prompt = PROMPTS.workshopDiscuss;
      prompt = prompt.replace("{{chapter}}", fragments[0].content);
      prompt = prompt.replace("{{history}}", historyText || "(初次讨论)");
      prompt = prompt.replace("{{answers}}", answersText);

      streamLLM({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: 0.7,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: "You are a writing workshop mentor. Always respond in Chinese." },
          { role: "user", content: prompt },
        ],
        signal: controller.signal,
        onChunk: (chunk) => send("streamChunk", { content: chunk }),
        onDone: (fullText) => {
          send("streamDone", { fullText });
          activeRequests.delete("workshop_answer_" + params.fragmentId);
        },
        onError: (message, code) => {
          send("streamError", { message, code });
          activeRequests.delete("workshop_answer_" + params.fragmentId);
        },
      });

      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("workshopRevise", async (params: {
      fragmentId: string;
      discussion: string;
    }) => {
      const config = getConfig(ctx);
      if (!config || !config.apiKey) {
        return { success: false, error: "LLM not configured" };
      }

      const fragments = loadFragments(ctx, [params.fragmentId]);
      if (fragments.length === 0) {
        return { success: false, error: "Fragment not found" };
      }

      const send = (channel: string, payload: any) => ctx.sendMessage(channel, payload);
      const controller = new AbortController();
      activeRequests.set("workshop_revise_" + params.fragmentId, controller);

      let prompt = PROMPTS.workshopRevise;
      prompt = prompt.replace("{{chapter}}", fragments[0].content);
      prompt = prompt.replace("{{discussion}}", params.discussion);

      streamLLM({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: "You are a senior literary editor revising based on workshop feedback." },
          { role: "user", content: prompt },
        ],
        signal: controller.signal,
        onChunk: (chunk) => send("streamChunk", { content: chunk }),
        onDone: (fullText) => {
          send("streamDone", { fullText });
          activeRequests.delete("workshop_revise_" + params.fragmentId);
        },
        onError: (message, code) => {
          send("streamError", { message, code });
          activeRequests.delete("workshop_revise_" + params.fragmentId);
        },
      });

      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("workshopAccept", async (params: { fragmentId: string }) => {
      // Accept workshop result — update fragment with revised content
      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("getLlmLogs", () => {
      return { success: true, data: llmLogs };
    }, { noPrefix: true });

    ctx.log("Agent engine ready (8 modes)");
  },
};

export default plugin;
