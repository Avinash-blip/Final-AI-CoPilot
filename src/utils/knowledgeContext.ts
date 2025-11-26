import fs from "fs";
import path from "path";

const SCHEMA_PATH = path.resolve(process.cwd(), "data/schema (1).md");
const METRICS_PATH = path.resolve(process.cwd(), "data/kb/metric_definitions.md");
const RULES_PATH = path.resolve(process.cwd(), "data/kb/business_rules.md");

interface KnowledgeBase {
  schema: string;
  metrics: string;
  rules: string;
}

let cachedKB: KnowledgeBase | null = null;

function loadFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to load KB file at ${filePath}:`, error);
    return "";
  }
}

export function loadKnowledgeBase(): KnowledgeBase {
  if (cachedKB) return cachedKB;

  cachedKB = {
    schema: loadFile(SCHEMA_PATH),
    metrics: loadFile(METRICS_PATH),
    rules: loadFile(RULES_PATH),
  };

  return cachedKB;
}

export function buildKnowledgePrompt(): string {
  const kb = loadKnowledgeBase();

  return `
SEMANTIC KNOWLEDGE BASE:

1. DATABASE SCHEMA (Use these columns ONLY):
${kb.schema}
    
2. METRIC DEFINITIONS (Use these formulas):
${kb.metrics}
    
3. BUSINESS RULES (Logic for delays, exceptions, and risks):
${kb.rules}
`;
}

/**
 * Build a smaller, targeted slice of the KB for narrative generation
 * based on simple keyword matching against the question and insights.
 */
export function buildNarrativeContext(question: string, insightSummary: string): { metrics: string; rules: string } {
  const kb = loadKnowledgeBase();
  const haystack = `${question}\n${insightSummary}`.toLowerCase();

  const metricLines = kb.metrics.split("\n");
  const ruleLines = kb.rules.split("\n");

  const pickLines = (lines: string[]) =>
    lines.filter((line) => {
      const l = line.toLowerCase();
      if (!l.trim()) return false;
      if (l.startsWith("#")) return true; // keep headings for structure

      // Simple keyword buckets
      if (haystack.includes("delay") || haystack.includes("sla") || haystack.includes("sta")) {
        if (l.includes("delay") || l.includes("sla") || l.includes("sta")) return true;
      }
      if (haystack.includes("epod") || haystack.includes("pod")) {
        if (l.includes("epod") || l.includes("pod")) return true;
      }
      if (haystack.includes("route")) {
        if (l.includes("route")) return true;
      }
      if (haystack.includes("transporter") || haystack.includes("carrier")) {
        if (l.includes("transporter")) return true;
      }

      return false;
    });

  const selectedMetrics = pickLines(metricLines);
  const selectedRules = pickLines(ruleLines);

  const metrics = selectedMetrics.length ? selectedMetrics.join("\n") : metricLines.slice(0, 20).join("\n");
  const rules = selectedRules.length ? selectedRules.join("\n") : ruleLines.slice(0, 30).join("\n");

  return { metrics, rules };
}
