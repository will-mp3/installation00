import { queryFTS } from "../db/fts.js";
import { queryVector } from "../db/vectors.js";
import { embed, isOllamaAvailable } from "../embeddings/ollama.js";

interface SearchResult {
  path: string;
  excerpt: string;
  score: number;
}

export async function searchVault(
  vaultPath: string,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const ftsResults = queryFTS(vaultPath, query, limit * 2);

  let vectorResults: Array<{ path: string; distance: number }> = [];

  const embedding = await embed(query);
  if (embedding) {
    vectorResults = queryVector(vaultPath, embedding, limit * 2);
  }

  // Merge and deduplicate
  const seen = new Map<string, SearchResult>();

  // FTS results — higher rank for exact term matches
  ftsResults.forEach((r, i) => {
    seen.set(r.path, {
      path: r.path,
      excerpt: r.snippet,
      score: 1 - i / (ftsResults.length || 1),
    });
  });

  // Vector results — boost semantic matches
  vectorResults.forEach((r, i) => {
    const vectorScore = 1 - i / (vectorResults.length || 1);
    const existing = seen.get(r.path);

    if (existing) {
      // Boost items found by both methods
      existing.score = (existing.score + vectorScore) * 1.2;
    } else {
      seen.set(r.path, {
        path: r.path,
        excerpt: "",
        score: vectorScore,
      });
    }
  });

  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
