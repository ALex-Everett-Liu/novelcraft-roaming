import type { MainPlugin } from "../../plugin-system/PluginManifest";
import type { MainPluginContext } from "../../plugin-system/PluginManifest";
import { manifest } from "./manifest";
import { streamLLM } from "../core-llm-client/index";
import { PROMPTS } from "./prompts";
import {
  PROTAGONIST_DIMENSIONS,
  ONTOLOGY_DIMENSIONS,
  OVERWRITE_DIMENSIONS,
  PARSE_MAX_TOKENS,
  EXTRACT_TEMPERATURE,
  EXTRACT_TEMPERATURE_RETRY,
  BRIDGE_TEMPERATURE,
} from "./types";
import { splitFragmentsByTokenLimit, buildChaptersText } from "./tokenize";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { getDataDir } from "../../database/connection";

interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface FragmentRow {
  id: string;
  title: string;
  content: string;
  order: number;
  projectId: string;
}

type ExtractionType = "protagonist" | "worldview" | "bridge";

function getConfig(): LLMConfig | null {
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

function loadFragments(ctx: MainPluginContext, projectId: string, ids?: string[]): FragmentRow[] {
  const db = ctx.getDatabase();
  let rows: any[];
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ");
    rows = db.query(`SELECT * FROM fragments WHERE id IN (${placeholders}) ORDER BY sort_order ASC`).all(...ids) as any[];
  } else {
    rows = db.query("SELECT * FROM fragments WHERE project_id = ? ORDER BY sort_order ASC").all(projectId) as any[];
  }
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title || "",
    content: r.content || "",
    order: r.sort_order as number,
    projectId: r.project_id as string,
  }));
}

function stripMarkdownFences(text: string): string {
  let t = text.trim();
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = t.match(fencePattern);
  if (match) t = match[1].trim();
  return t;
}

function safeSerialize(value: any): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseJsonResponse(content: string, dimensions: readonly string[]): Record<string, any> | null {
  const text = stripMarkdownFences(content);
  try {
    const data = JSON.parse(text);
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      const result: Record<string, any> = {};
      for (const dim of dimensions) {
        const val = data[dim];
        result[dim] = val && typeof val === "object" && !Array.isArray(val) ? val : {};
      }
      return result;
    }
  } catch {}
  return null;
}

function mergeFields(
  accumulated: Record<string, any>,
  newBatch: Record<string, any>,
  dimensions: readonly string[],
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const dim of dimensions) {
    const oldVal = accumulated[dim] || {};
    const newVal = newBatch[dim] || {};

    if (!oldVal || Object.keys(oldVal).length === 0) {
      result[dim] = typeof newVal === "object" && !Array.isArray(newVal) ? newVal : {};
      continue;
    }
    if (!newVal || Object.keys(newVal).length === 0) {
      result[dim] = typeof oldVal === "object" && !Array.isArray(oldVal) ? oldVal : {};
      continue;
    }

    if (OVERWRITE_DIMENSIONS.has(dim)) {
      result[dim] = typeof newVal === "object" && !Array.isArray(newVal) ? newVal : {};
    } else {
      const mergedDim: Record<string, any> = { ...oldVal };
      for (const [k, v] of Object.entries(newVal)) {
        if (!(k in mergedDim) || !mergedDim[k]) {
          mergedDim[k] = v;
        } else {
          const oldStr = safeSerialize(mergedDim[k]);
          const newStr = safeSerialize(v);
          if (newStr.length >= oldStr.length) {
            mergedDim[k] = v;
          }
        }
      }
      result[dim] = mergedDim;
    }
  }

  return result;
}

let currentAbortController: AbortController | null = null;

const plugin: MainPlugin = {
  manifest,

  async onLoad(ctx: MainPluginContext) {
    const db = ctx.getDatabase();

    ctx.runMigration(1, "add_novel_profile", `
      ALTER TABLE projects ADD COLUMN novel_profile TEXT DEFAULT '{}'
    `);

    ctx.runMigration(2, "add_protagonist_profile", `
      ALTER TABLE projects ADD COLUMN protagonist_profile TEXT
    `);

    ctx.runMigration(3, "add_world_ontology", `
      ALTER TABLE projects ADD COLUMN world_ontology TEXT
    `);

    function saveProfile(projectId: string, field: string, value: string | null): void {
      const ts = String(Date.now());
      if (value !== null) {
        db.run(`UPDATE projects SET ${field} = ?, updated_at = ? WHERE id = ?`, [value, ts, projectId]);
      } else {
        db.run(`UPDATE projects SET ${field} = ${field}, updated_at = ? WHERE id = ?`, [ts, projectId]);
      }
    }

    // ===== Public: get profiles =====

    ctx.registerRpcHandler("protagonistGet", (params: { projectId: string }) => {
      const row = db.query("SELECT protagonist_profile, name FROM projects WHERE id = ?").get(params.projectId) as any;
      if (!row) return { success: false, error: "Project not found" };
      const data = row.protagonist_profile ? JSON.parse(row.protagonist_profile) : null;
      return { success: true, data };
    }, { noPrefix: true });

    ctx.registerRpcHandler("worldOntologyGet", (params: { projectId: string }) => {
      const row = db.query("SELECT world_ontology, name FROM projects WHERE id = ?").get(params.projectId) as any;
      if (!row) return { success: false, error: "Project not found" };
      const data = row.world_ontology ? JSON.parse(row.world_ontology) : null;
      return { success: true, data };
    }, { noPrefix: true });

    ctx.registerRpcHandler("novelProfileSave", (params: { projectId: string; novelProfile: any }) => {
      saveProfile(params.projectId, "novel_profile", JSON.stringify(params.novelProfile || {}));
      return { success: true };
    }, { noPrefix: true });

    // ===== Extraction core =====

    const doExtraction = async (
      type: ExtractionType,
      params: { projectId: string; fragmentIds?: string[] },
    ) => {
      const config = getConfig();
      if (!config || !config.apiKey) {
        ctx.sendMessage("extractionError", { type, message: "LLM not configured", code: "NO_CONFIG" });
        return;
      }

      const send = (channel: string, payload: any) => ctx.sendMessage(channel, payload);

      const fragments = loadFragments(ctx, params.projectId, params.fragmentIds);
      if (fragments.length === 0) {
        send("extractionError", { type, message: "No fragments to analyze", code: "NO_DATA" });
        return;
      }

      const controller = new AbortController();
      if (currentAbortController) currentAbortController.abort();
      currentAbortController = controller;

      const dimensions = type === "protagonist"
        ? PROTAGONIST_DIMENSIONS as unknown as readonly string[]
        : ONTOLOGY_DIMENSIONS as unknown as readonly string[];
      const promptTemplate = type === "protagonist" ? PROMPTS.protagonistExtract : PROMPTS.worldOntologyExtract;
      const dbColumn = type === "protagonist" ? "protagonist_profile" : "world_ontology";
      const extractMaxTokens = PARSE_MAX_TOKENS;

      // Read existing profile
      const projectRow = db.query(`SELECT ${dbColumn}, novel_profile FROM projects WHERE id = ?`).get(params.projectId) as any;
      const existingProfile = projectRow?.[dbColumn] ? JSON.parse(projectRow[dbColumn]) : null;
      const novelProfile = projectRow?.novel_profile ? JSON.parse(projectRow.novel_profile) : {};

      // Split into batches
      const inputLimit = Math.min(config.maxTokens, 64000);
      const batches = splitFragmentsByTokenLimit(fragments, inputLimit);
      const batchCount = batches.length;

      send("extractionProgress", { type, batch: 0, totalBatches: batchCount });

      let accumulated: Record<string, any> = {};
      const batchResults: Record<string, any>[] = [];

      for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
        if (controller.signal.aborted) {
          send("extractionError", { type, message: "Extraction cancelled", code: "CANCELLED" });
          return;
        }

        const batch = batches[batchIdx];
        const chaptersText = buildChaptersText(batch.fragments);

        const accumulatedText = batchIdx === 0
          ? "（首批提取，无前序参考）"
          : JSON.stringify(accumulated, null, 2);

        let prompt = promptTemplate
          .replace("{{title}}", novelProfile.title || "")
          .replace("{{author}}", novelProfile.author || "")
          .replace("{{protagonist}}", novelProfile.protagonist || "")
          .replace("{{synopsis}}", novelProfile.synopsis || "")
          .replace("{{worldSetting}}", novelProfile.worldSetting || "")
          .replace("{{writingStyle}}", novelProfile.writingStyle || "")
          .replace("{{chaptersText}}", chaptersText);

        if (type === "protagonist") {
          prompt = prompt.replace("{{accumulatedProfile}}", accumulatedText);
        } else {
          prompt = prompt.replace("{{accumulatedOntology}}", accumulatedText);
        }

        // Extraction with retry
        let batchResult: Record<string, any> | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (controller.signal.aborted) return;

          try {
            let fullText = "";
            await new Promise<void>((resolve, reject) => {
              streamLLM({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                model: config.model,
                temperature: attempt === 0 ? EXTRACT_TEMPERATURE : EXTRACT_TEMPERATURE_RETRY,
                maxTokens: extractMaxTokens,
                messages: [
                  { role: "system", content: "You are a literary analysis expert. Return ONLY valid JSON. Always respond in Chinese." },
                  { role: "user", content: prompt },
                ],
                signal: controller.signal,
                onChunk: (chunk) => {
                  fullText += chunk;
                  send("extractionChunk", { type, content: chunk, phase: `batch ${batchIdx + 1}/${batchCount}` });
                },
                onDone: () => {
                  const parsed = parseJsonResponse(fullText, dimensions);
                  if (parsed) {
                    batchResult = parsed;
                    resolve();
                  } else {
                    if (attempt === 0) {
                      resolve(); // Will retry
                    } else {
                      reject(new Error("JSON parse failed after retry"));
                    }
                  }
                },
                onError: (msg, code) => reject(new Error(msg)),
              });
            });

            if (batchResult) break;
          } catch (e: any) {
            if (controller.signal.aborted) return;
            if (attempt === 1) {
              send("extractionError", { type, message: `Batch ${batchIdx + 1} failed: ${e.message}`, code: "EXTRACT_FAILED" });
              return;
            }
          }
        }

        if (!batchResult) return;

        batchResults.push(batchResult);
        accumulated = mergeFields(accumulated, batchResult, dimensions);

        send("extractionProgress", { type, batch: batchIdx + 1, totalBatches: batchCount });
      }

      if (controller.signal.aborted) return;

      // Multi-batch merge via LLM if needed
      if (batchCount > 1 && batchResults.length > 1) {
        try {
          const mergeTemplate = type === "protagonist" ? PROMPTS.protagonistMerge : PROMPTS.worldOntologyMerge;
          const entriesText = batchResults.map((b, i) =>
            `## 批次 ${i + 1}/${batchCount}\n\n\`\`\`json\n${JSON.stringify(b, null, 2)}\n\`\`\``
          ).join("\n\n");
          const mergePrompt = mergeTemplate.replace("{{entriesBlocks}}", entriesText);

          let mergeText = "";
          await new Promise<void>((resolve, reject) => {
            streamLLM({
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              model: config.model,
              temperature: EXTRACT_TEMPERATURE,
              maxTokens: extractMaxTokens,
              messages: [
                { role: "system", content: "You are a literary analysis expert. Return ONLY valid JSON." },
                { role: "user", content: mergePrompt },
              ],
              signal: controller.signal,
              onChunk: (chunk) => {
                mergeText += chunk;
                send("extractionChunk", { type, content: chunk, phase: "merge" });
              },
              onDone: () => {
                const parsed = parseJsonResponse(mergeText, dimensions);
                if (parsed && Object.keys(parsed).length > 0) {
                  accumulated = parsed;
                }
                resolve();
              },
              onError: () => resolve(), // Fall back to programmatic merge
            });
          });
        } catch {}
      }

      // Save to DB
      const ts = String(Date.now());
      if (type === "protagonist") {
        db.run("UPDATE projects SET protagonist_profile = ?, updated_at = ? WHERE id = ?", [JSON.stringify(accumulated), ts, params.projectId]);

        // Auto-fill novelProfile from basicAnchors if missing
        if (!novelProfile.title && !novelProfile.protagonist && accumulated.basicAnchors) {
          const ba = accumulated.basicAnchors;
          const autoProfile: Record<string, string> = {};
          if (ba.name) autoProfile.title = String(ba.name);
          if (ba.name) autoProfile.protagonist = String(ba.name);
          db.run("UPDATE projects SET novel_profile = ?, updated_at = ? WHERE id = ?", [JSON.stringify({ ...novelProfile, ...autoProfile }), String(Date.now()), params.projectId]);
        }
      } else {
        db.run("UPDATE projects SET world_ontology = ?, updated_at = ? WHERE id = ?", [JSON.stringify(accumulated), ts, params.projectId]);
      }

      send("extractionDone", {
        type,
        result: accumulated,
        statusMessage: batchCount === 1 ? "提取完成（1 批次）" : `提取完成（${batchCount} 批次，已合并）`,
      });
    };

    // ===== Bridge extraction =====

    const doBridge = async (projectId: string) => {
      const config = getConfig();
      if (!config || !config.apiKey) return;

      const send = (channel: string, payload: any) => ctx.sendMessage(channel, payload);

      const row = db.query("SELECT protagonist_profile, world_ontology FROM projects WHERE id = ?").get(projectId) as any;
      const protagonistProfile = row?.protagonist_profile ? JSON.parse(row.protagonist_profile) : null;
      const worldOntology = row?.world_ontology ? JSON.parse(row.world_ontology) : null;

      if (!protagonistProfile || !worldOntology) return;

      const controller = new AbortController();
      currentAbortController = controller;

      let prompt = PROMPTS.bridgeExtract;
      prompt = prompt.replace("{{protagonistProfile}}", JSON.stringify(protagonistProfile, null, 2));
      prompt = prompt.replace("{{worldOntology}}", JSON.stringify(worldOntology, null, 2));

      let fullText = "";
      try {
        await new Promise<void>((resolve, reject) => {
          streamLLM({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            model: config.model,
            temperature: BRIDGE_TEMPERATURE,
            maxTokens: 8000,
            messages: [
              { role: "system", content: "You are a cross-disciplinary narrative theory analyst. Return ONLY valid JSON." },
              { role: "user", content: prompt },
            ],
            signal: controller.signal,
            onChunk: (chunk) => {
              fullText += chunk;
              send("extractionChunk", { type: "bridge", content: chunk, phase: "bridge" });
            },
            onDone: () => {
              try {
                const data = JSON.parse(stripMarkdownFences(fullText));
                if (data && typeof data === "object") {
                  const profile = row?.protagonist_profile ? JSON.parse(row.protagonist_profile) : {};
                  if (data.worldInteraction && typeof data.worldInteraction === "object") {
                    profile.worldInteraction = data.worldInteraction;
                  }
                  if (data.profileAmendments && typeof data.profileAmendments === "object") {
                    for (const [dim, val] of Object.entries(data.profileAmendments)) {
                      if (PROTAGONIST_DIMENSIONS.includes(dim as any)) {
                        profile[dim] = { ...(profile[dim] || {}), ...(val as any) };
                      }
                    }
                  }
                  const ts = String(Date.now());
                  db.run("UPDATE projects SET protagonist_profile = ?, updated_at = ? WHERE id = ?", [JSON.stringify(profile), ts, projectId]);
                  send("extractionDone", {
                    type: "bridge",
                    result: data,
                    statusMessage: "主角-世界观桥接分析完成",
                  });
                }
              } catch {}
              resolve();
            },
            onError: () => resolve(),
          });
        });
      } catch {}
    };

    // ===== RPC handlers =====

    ctx.registerRpcHandler("protagonistExtract", async (params: {
      projectId: string;
      fragmentIds?: string[];
    }) => {
      doExtraction("protagonist", params);
      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("worldOntologyExtract", async (params: {
      projectId: string;
      fragmentIds?: string[];
    }) => {
      doExtraction("worldview", params);
      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("bridgeExtract", async (params: {
      projectId: string;
    }) => {
      doBridge(params.projectId);
      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("extractionCancel", () => {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      return { success: true };
    }, { noPrefix: true });

    ctx.log("Context extractor ready (14-dim profile + 7-dim ontology + bridge)");
  },
};

export default plugin;
