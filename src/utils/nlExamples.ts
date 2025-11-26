import fs from "fs";
import path from "path";

const EXAMPLES_PATH = path.resolve(process.cwd(), "data/nl_examples.json");

export interface NlExample {
  id: string;
  match_keywords: string[];
  example_insight: string;
  example_answer: string;
}

let cachedExamples: NlExample[] | null = null;

function loadExamples(): NlExample[] {
  if (cachedExamples) return cachedExamples;

  try {
    const raw = fs.readFileSync(EXAMPLES_PATH, "utf-8");
    const parsed = JSON.parse(raw) as NlExample[];
    cachedExamples = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load NL examples:", error);
    cachedExamples = [];
  }

  return cachedExamples;
}

export function findNlExample(question: string): NlExample | null {
  const examples = loadExamples();
  if (!examples.length) return null;

  const q = question.toLowerCase();

  let best: { ex: NlExample; score: number } | null = null;

  for (const ex of examples) {
    const keywords = ex.match_keywords || [];
    if (!keywords.length) continue;

    let hits = 0;
    for (const kw of keywords) {
      if (q.includes(kw.toLowerCase())) hits += 1;
    }
    const score = hits / keywords.length;
    if (!best || score > best.score) {
      best = { ex, score };
    }
  }

  if (!best || best.score < 0.5) return null;
  return best.ex;
}


