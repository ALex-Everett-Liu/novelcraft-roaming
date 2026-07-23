import { encodingForModel } from "js-tiktoken";

const enc = encodingForModel("gpt-4o");

interface TokenBatch {
  fragments: FragmentRow[];
  startIndex: number;
  endIndex: number;
  tokenCount: number;
}

interface FragmentRow {
  id: string;
  title: string;
  content: string;
  order: number;
}

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export function splitFragmentsByTokenLimit(
  fragments: FragmentRow[],
  maxTokens: number,
): TokenBatch[] {
  if (maxTokens <= 0 || fragments.length === 0) {
    return [{ fragments, startIndex: 0, endIndex: Math.max(0, fragments.length - 1), tokenCount: 0 }];
  }

  const tokenCache = new Map<string, number>();
  for (const f of fragments) {
    const text = `## ${f.title}\n\n${f.content}`;
    tokenCache.set(f.id, countTokens(text));
  }

  const batches: TokenBatch[] = [];
  let current: FragmentRow[] = [];
  let currentTokens = 0;
  let startIdx = 0;

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    const t = tokenCache.get(f.id) ?? 0;

    if (current.length > 0 && currentTokens + t > maxTokens) {
      batches.push({
        fragments: current,
        startIndex: startIdx,
        endIndex: i - 1,
        tokenCount: currentTokens,
      });
      current = [];
      currentTokens = 0;
      startIdx = i;
    }
    current.push(f);
    currentTokens += t;
  }

  if (current.length > 0) {
    batches.push({
      fragments: current,
      startIndex: startIdx,
      endIndex: fragments.length - 1,
      tokenCount: currentTokens,
    });
  }

  return batches;
}

export function buildChaptersText(fragments: FragmentRow[]): string {
  return fragments
    .map((f) => `## ${f.title || `Fragment ${f.order}`}\n\n${f.content}`)
    .join("\n\n");
}
