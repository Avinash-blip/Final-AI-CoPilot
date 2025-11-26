import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const FIXTURE_PATH = path.resolve(process.cwd(), "data/BG_Fixture - Sheet1.csv");

export interface QuestionFixture {
  id: string;
  question: string;
  sql: string;
  template: string;
}

interface MatchResult {
  fixture: QuestionFixture;
  score: number;
}

let cachedFixtures: QuestionFixture[] | null = null;

function loadFixtures(): QuestionFixture[] {
  if (cachedFixtures) return cachedFixtures;

  try {
    const csv = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;

    cachedFixtures = records.map((row) => ({
      id: row["Sno"] ?? "",
      question: row["Question"] ?? "",
      sql: row["SQL Query"] ?? "",
      template: row["NL Template"] ?? "",
    }));
  } catch (error) {
    console.error("Failed to load question bank fixtures:", error);
    cachedFixtures = [];
  }

  return cachedFixtures;
}

const STOP_WORDS = new Set([
  "what",
  "is",
  "the",
  "a",
  "an",
  "of",
  "for",
  "in",
  "on",
  "to",
  "by",
  "how",
  "many",
  "much",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "show",
  "me",
  "list",
  "give",
  "can",
  "you",
  "please",
  "get",
  "tell",
]);

const SYNONYM_MAP: Record<string, string> = {
  sender: "consignor",
  senders: "consignors",
  customer: "consignor",
  customers: "consignors",
  carrier: "transporter",
  carriers: "transporters",
  lane: "route",
  lanes: "routes",
  "%": "percentage",
  "pct": "percentage",
  "percent": "percentage",
  "delay": "delayed",
  "delays": "delayed",
  "late": "delayed",
  "breach": "breached",
  "breaches": "breached",
  "sta": "breached",
  "sla": "breached",
  "stoppage": "stoppages",
  "stop": "stoppages",
  "deviation": "deviations",
  "deviate": "deviations",
  "top": "highest",
  "most": "highest",
  "maximum": "highest",
  "max": "highest",
  "bottom": "lowest",
  "least": "lowest",
  "minimum": "lowest",
  "min": "lowest",
  "count": "total",
  "number": "total",
  "volume": "total",
  "dataset": "trips",
  "data": "trips",
};

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?.!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => SYNONYM_MAP[token] ?? token)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function similarityScore(userTokens: string[], fixtureTokens: string[]): number {
  if (!userTokens.length || !fixtureTokens.length) return 0;
  const userSet = new Set(userTokens);
  const fixtureSet = new Set(fixtureTokens);

  let intersection = 0;
  fixtureSet.forEach((t) => {
    if (userSet.has(t)) intersection += 1;
  });

  return intersection / userSet.size;
}

// Extract key intent phrases for boosting
function extractIntentPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  const phrases: string[] = [];
  
  // Delay/performance intent
  if (lower.includes("delay") || lower.includes("late") || lower.includes("breach")) {
    phrases.push("delayed");
  }
  if (lower.includes("%") || lower.includes("percent") || lower.includes("pct")) {
    phrases.push("percentage");
  }
  
  // Entity intent
  if (lower.includes("transport") || lower.includes("carrier")) {
    phrases.push("transporter");
  }
  if (lower.includes("route") || lower.includes("lane")) {
    phrases.push("route");
  }
  if (lower.includes("consign") || lower.includes("sender") || lower.includes("customer")) {
    phrases.push("consignor");
  }
  if (lower.includes("vehicle")) {
    phrases.push("vehicle");
  }
  
  // Aggregation intent
  if (lower.includes("top") || lower.includes("most") || lower.includes("highest") || lower.includes("max")) {
    phrases.push("highest");
  }
  if (lower.includes("count") || lower.includes("total") || lower.includes("number") || lower.includes("how many")) {
    phrases.push("total");
  }
  
  // Alert types
  if (lower.includes("stoppage") || lower.includes("stop")) {
    phrases.push("stoppages");
  }
  if (lower.includes("deviation") || lower.includes("deviate")) {
    phrases.push("deviations");
  }
  
  return phrases;
}

export function matchQuestion(userQuestion: string, threshold = 0.55): MatchResult | null {
  const fixtures = loadFixtures();
  if (!fixtures.length) return null;

  const normalizedUser = normalizeQuestion(userQuestion);

  // Fast path: exact normalized match against canonical question
  for (const fixture of fixtures) {
    const normalizedFixture = normalizeQuestion(fixture.question);
    if (normalizedUser && normalizedUser === normalizedFixture) {
      return { fixture, score: 1 };
    }
  }

  const userTokens = tokenize(userQuestion);
  
  // For very short queries, use fuzzy phrase matching instead
  if (userTokens.length <= 2) {
    return fuzzyPhraseMatch(normalizedUser, fixtures, threshold);
  }

  // Extract intent phrases for boosting
  const userIntent = extractIntentPhrases(userQuestion);

  let best: MatchResult | null = null;

  for (const fixture of fixtures) {
    const fixtureTokens = tokenize(fixture.question);
    let score = similarityScore(userTokens, fixtureTokens);
    
    // Boost score if intent phrases match (increased to 40%)
    if (userIntent.length > 0) {
      const fixtureIntent = extractIntentPhrases(fixture.question);
      const intentOverlap = userIntent.filter(i => fixtureIntent.includes(i)).length;
      const intentBoost = intentOverlap / Math.max(userIntent.length, 1) * 0.4;
      score = Math.min(1, score + intentBoost);
    }
    
    // Bonus for matching key entity + metric combo
    const comboBonus = getComboBonus(normalizedUser, fixture.question);
    score = Math.min(1, score + comboBonus);
    
    if (!best || score > best.score) {
      best = { fixture, score };
    }
  }

  if (!best || best.score < threshold) {
    return null;
  }

  return best;
}

/**
 * Fuzzy phrase matching for short queries like "% delay" or "top routes"
 */
function fuzzyPhraseMatch(userPhrase: string, fixtures: QuestionFixture[], threshold: number): MatchResult | null {
  const lower = userPhrase.toLowerCase();
  
  // Define phrase patterns that map to specific question types
  const phrasePatterns: Array<{ patterns: string[]; questionKeywords: string[] }> = [
    { patterns: ["% delay", "delay %", "percent delay", "delayed percentage"], questionKeywords: ["percentage", "delayed"] },
    { patterns: ["% by transporter", "transporter delay", "delay transporter"], questionKeywords: ["percentage", "delayed", "transporter"] },
    { patterns: ["% by route", "route delay", "delay route"], questionKeywords: ["percentage", "delayed", "route"] },
    { patterns: ["top route", "busiest route", "most trips route"], questionKeywords: ["top", "route", "trips"] },
    { patterns: ["top transporter", "busiest transporter"], questionKeywords: ["top", "transporter", "trips"] },
    { patterns: ["sta breach", "breach sta", "breached"], questionKeywords: ["breached", "sta"] },
    { patterns: ["long stoppage", "stoppages"], questionKeywords: ["long", "stoppage"] },
    { patterns: ["route deviation", "deviations"], questionKeywords: ["route", "deviation"] },
    { patterns: ["total trips", "trip count", "how many trips"], questionKeywords: ["total", "trips"] },
  ];
  
  // Find matching phrase pattern
  let matchedKeywords: string[] = [];
  for (const { patterns, questionKeywords } of phrasePatterns) {
    if (patterns.some(p => lower.includes(p))) {
      matchedKeywords = questionKeywords;
      break;
    }
  }
  
  if (matchedKeywords.length === 0) {
    // Extract intent as fallback
    matchedKeywords = extractIntentPhrases(userPhrase);
  }
  
  if (matchedKeywords.length === 0) return null;
  
  let best: MatchResult | null = null;
  
  for (const fixture of fixtures) {
    const fixtureLower = fixture.question.toLowerCase();
    const matchCount = matchedKeywords.filter(kw => fixtureLower.includes(kw)).length;
    const score = matchCount / matchedKeywords.length;
    
    if (!best || score > best.score) {
      best = { fixture, score };
    }
  }
  
  if (!best || best.score < threshold) return null;
  return best;
}

/**
 * Bonus for matching key entity + metric combinations
 */
function getComboBonus(userQ: string, fixtureQ: string): number {
  const lower = userQ.toLowerCase();
  const fixtureLower = fixtureQ.toLowerCase();
  
  // Entity + Metric combos that should strongly match
  const combos = [
    { entity: ["transporter", "carrier"], metric: ["delay", "percent", "%"] },
    { entity: ["route", "lane"], metric: ["delay", "percent", "%"] },
    { entity: ["consignor", "sender"], metric: ["delay", "percent", "%"] },
    { entity: ["route", "lane"], metric: ["stoppage", "stop"] },
    { entity: ["transporter", "carrier"], metric: ["stoppage", "stop"] },
  ];
  
  for (const { entity, metric } of combos) {
    const userHasEntity = entity.some(e => lower.includes(e));
    const userHasMetric = metric.some(m => lower.includes(m));
    const fixtureHasEntity = entity.some(e => fixtureLower.includes(e));
    const fixtureHasMetric = metric.some(m => fixtureLower.includes(m));
    
    if (userHasEntity && userHasMetric && fixtureHasEntity && fixtureHasMetric) {
      return 0.25; // 25% bonus for matching combo
    }
  }
  
  return 0;
}

export function renderTemplate(template: string, row: Record<string, any>): string {
  if (!template) return "";
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const raw = row[key.trim()];
    if (raw === null || raw === undefined) return "0";
    if (typeof raw === "number") return raw.toLocaleString();
    return String(raw);
  });
}


