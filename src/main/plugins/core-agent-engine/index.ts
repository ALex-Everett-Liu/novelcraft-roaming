import type { MainPlugin } from "../../plugin-system/PluginManifest";
import type { MainPluginContext } from "../../plugin-system/PluginManifest";
import { manifest } from "./manifest";
import { streamLLM } from "../core-llm-client/index";
import { PROMPTS } from "./prompts";
import path from "path";
import { existsSync, readFileSync } from "fs";

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
  const db = ctx.getDatabase();
  try {
    const dataDir = process.env.ELECTROBUN_APP_DATA || path.resolve("data");
    const configPath = path.join(dataDir, "config.json");
    if (existsSync(configPath)) {
      const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
      return {
        baseUrl: cfg.llm?.baseUrl || "https://api.openai.com",
        apiKey: cfg.llm?.apiKey || "",
        model: cfg.llm?.model || "gpt-4o",
        temperature: cfg.llm?.temperature ?? 0.8,
        maxTokens: cfg.llm?.maxTokens ?? 4096,
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
          // Workshop analyze phase — handled by workshopStart RPC
          return { success: false, error: "Workshop mode must be started via workshopStart" };
        }
        default:
          return { success: false, error: `Unknown agent mode: ${params.mode}` };
      }

      // Start streaming
      streamLLM({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        messages,
        signal: controller.signal,
        onChunk: (chunk) => send("streamChunk", { content: chunk }),
        onDone: (fullText) => send("streamDone", { fullText }),
        onError: (message, code) => send("streamError", { message, code }),
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
    ctx.registerRpcHandler("workshopStart", async (params: { fragmentId: string }) => {
      const config = getConfig(ctx);
      if (!config || !config.apiKey) {
        return { success: false, error: "LLM not configured" };
      }

      const fragments = loadFragments(ctx, [params.fragmentId]);
      if (fragments.length === 0) {
        return { success: false, error: "Fragment not found" };
      }

      const fragment = fragments[0];
      if (fragment.wordCount < 100) {
        return { success: false, error: "Workshop requires a fragment with at least 100 words" };
      }

      const send = (channel: string, payload: any) => ctx.sendMessage(channel, payload);

      const controller = new AbortController();
      activeRequests.set("workshop_" + params.fragmentId, controller);

      let fullText = "";
      const prompt = PROMPTS.workshopAnalyze.replace("{{chapter}}", fragment.content);

      await streamLLM({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: 0.3,
        maxTokens: 2000,
        messages: [
          { role: "system", content: "You are a strict writing workshop mentor. Return ONLY valid JSON." },
          { role: "user", content: prompt },
        ],
        signal: controller.signal,
        onChunk: (chunk) => { fullText += chunk; },
        onDone: () => {
          try {
            const jsonMatch = fullText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const questions = JSON.parse(jsonMatch[0]);
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
              send("workshopStateChanged", state);
            } else {
              send("streamError", { message: "Failed to parse workshop questions" });
            }
          } catch (e: any) {
            send("streamError", { message: "Failed to parse workshop questions: " + e.message });
          }
          activeRequests.delete("workshop_" + params.fragmentId);
        },
        onError: (message, code) => {
          send("streamError", { message, code });
          activeRequests.delete("workshop_" + params.fragmentId);
        },
      });

      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("workshopAnswer", (params: {
      fragmentId: string;
      answers: { questionId: string; answer: string }[];
    }) => {
      // Store answers — in a real implementation, this would persist in state
      // For now, the renderer tracks these locally
      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("workshopRevise", async (params: { fragmentId: string }) => {
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

      // The revision prompt needs the chapter and Q&A data
      // In production, this would retrieve stored answers from state
      let prompt = PROMPTS.workshopRevise.replace("{{chapter}}", fragments[0].content);

      await streamLLM({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        messages: [
          { role: "system", content: "You are a senior literary editor." },
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
      // The revised content is tracked by the renderer
      return { success: true };
    }, { noPrefix: true });

    ctx.log("Agent engine ready (8 modes)");
  },
};

export default plugin;
