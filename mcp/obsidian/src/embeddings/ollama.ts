// embeddinggemma has a 2048-token context. Anything past it is ignored by the
// model, but Ollama still pays to tokenize it, and the cost grows faster than
// linearly: ~1.7s for 2KB, ~20s for 8KB, and a 105KB note never returns at all.
// Truncating to roughly the context window costs nothing in quality — the model
// could not see past it either way — and keeps one oversized note from stalling
// a whole reindex.
const MAX_INPUT_CHARS = 8000; // ~2048 tokens at ~4 chars/token
const REQUEST_TIMEOUT_MS = 60_000;

let ollamaAvailable: boolean | null = null;

export async function embed(text: string): Promise<number[] | null> {
  // Nothing to embed. Not a failure, but there is no meaningful vector either.
  if (text.trim().length === 0) return null;

  try {
    const response = await fetch("http://localhost:11434/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "embeddinggemma",
        input: text.slice(0, MAX_INPUT_CHARS),
      }),
      // Without this a hung request blocks the indexer forever.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      ollamaAvailable = false;
      return null;
    }

    const data = (await response.json()) as {
      embeddings: number[][];
    };

    ollamaAvailable = true;
    return data.embeddings[0] ?? null;
  } catch {
    ollamaAvailable = false;
    return null;
  }
}

export function isOllamaAvailable(): boolean {
  return ollamaAvailable === true;
}
