import type { MainPlugin } from "../../plugin-system/PluginManifest";
import type { MainPluginContext } from "../../plugin-system/PluginManifest";
import { manifest } from "./manifest";

export interface LLMStreamOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  messages: { role: string; content: string }[];
  onChunk: (chunk: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string, code?: string) => void;
  signal?: AbortSignal;
}

export async function streamLLM(options: LLMStreamOptions): Promise<void> {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.8,
    max_tokens: options.maxTokens ?? 8192,
    stream: true,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      options.onError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR"
      );
      return;
    }

    if (!response.body) {
      options.onError("No response body", "NO_BODY");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          options.onDone(fullText);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            options.onChunk(content);
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    options.onDone(fullText);
  } catch (err: any) {
    if (err.name === "AbortError") {
      options.onError("Request cancelled", "CANCELLED");
    } else {
      options.onError(err.message || String(err), "NETWORK_ERROR");
    }
  }
}

const plugin: MainPlugin = {
  manifest,
  async onLoad(ctx: MainPluginContext) {
    ctx.log("LLM client ready");
  },
};

export default plugin;
