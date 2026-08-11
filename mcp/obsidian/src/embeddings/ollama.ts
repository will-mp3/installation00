let ollamaAvailable: boolean | null = null;

export async function embed(text: string): Promise<number[] | null> {
  try {
    const response = await fetch("http://localhost:11434/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "embeddinggemma",
        input: text,
      }),
    });

    if (!response.ok) {
      ollamaAvailable = false;
      return null;
    }

    const data = (await response.json()) as {
      embeddings: number[][];
    };

    ollamaAvailable = true;
    return data.embeddings[0];
  } catch {
    ollamaAvailable = false;
    return null;
  }
}

export function isOllamaAvailable(): boolean {
  return ollamaAvailable === true;
}
