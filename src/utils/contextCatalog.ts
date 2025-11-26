import fs from "fs";
import path from "path";

const CONTEXT_PATH = path.resolve(process.cwd(), "data/schema (1).md");

interface ColumnContext {
  column: string;
  type: string;
  example: string;
  nullable: string;
  description: string;
}

let cachedColumns: ColumnContext[] | null = null;

function loadContext(): ColumnContext[] {
  if (cachedColumns) return cachedColumns;

  try {
    const fileContent = fs.readFileSync(CONTEXT_PATH, "utf-8");
    const lines = fileContent.split("\n").filter(line => line.trim().length > 0);
    
    // Skip header (starts with Sno)
    const dataLines = lines.filter(line => !line.startsWith("Sno"));

    cachedColumns = dataLines.map(line => {
      // Split by tab
      const parts = line.split("\t").map(p => p.trim());
      
      if (parts.length < 6) return null;

      // Unescape column names (remove backslashes before underscores)
      const rawCol = parts[1] || "";
      const column = rawCol.replace(/\\_/g, "_");

      return {
        column,
        type: parts[2] || "",
        example: parts[3] || "",
        nullable: parts[4] || "",
        description: parts[5] || ""
      };
    }).filter((item): item is ColumnContext => item !== null);

  } catch (error) {
    console.error("Failed to load context catalog:", error);
    cachedColumns = [];
  }

  return cachedColumns;
}

export function getContextCatalog(): ColumnContext[] {
  return loadContext();
}

export function buildContextSnippet(question: string, maxEntries = 18): string {
  const columns = loadContext();
  if (!columns.length) {
    return "No additional column context available.";
  }

  const keywords = question
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);

  const scored = columns
    .map((col) => {
      const haystack = `${col.column} ${col.description}`.toLowerCase();
      const score = keywords.reduce(
        (acc, word) => (haystack.includes(word) ? acc + 1 : acc),
        0
      );
      return { col, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected =
    scored.filter((entry) => entry.score > 0).slice(0, maxEntries) ||
    scored.slice(0, maxEntries);

  const lines = selected.map(
    ({ col }) =>
      `- ${col.column} (${col.type}, nullable: ${col.nullable}) — ${col.description}`
  );

  return lines.join("\n");
}

export function applyQueryGuards(sql: string): string {
  let guarded = sql;

  // Guard: Filter out NULL transporter names if the query references them
  if (/trip_transporter_name/i.test(guarded) && !/transporter_name\s+IS\s+NOT\s+NULL/i.test(guarded)) {
    if (/where/i.test(guarded)) {
      // Safe insertion into existing WHERE
      guarded = guarded.replace(/where/i, (match) => `${match} trip_transporter_name IS NOT NULL AND trip_transporter_name != '' AND`);
    } else {
      // Append new WHERE before GROUP BY, ORDER BY, or LIMIT
      const suffixMatch = guarded.match(/(group\s+by|order\s+by|limit|$)/i);
      if (suffixMatch) {
        const index = suffixMatch.index!;
        guarded = `${guarded.slice(0, index)} WHERE trip_transporter_name IS NOT NULL AND trip_transporter_name != '' ${guarded.slice(index)}`;
      }
    }
  }

  // Guard: Ensure meaningful grouping for transporters (at least 5 trips)
  if (/trip_transporter_name/i.test(guarded) && /group\s+by/i.test(guarded) && !/having/i.test(guarded)) {
    const suffixMatch = guarded.match(/(order\s+by|limit|$)/i);
    if (suffixMatch) {
      const index = suffixMatch.index!;
      guarded = `${guarded.slice(0, index)} HAVING COUNT(*) >= 5 ${guarded.slice(index)}`;
    }
  }

  return guarded;
}

export function getBusinessRulesSummary(): string {
  return `
Key business rules:
1. On-time trips = sta_breached_alert = 0 AND "Total Long Stoppage Alerts" = 0.
2. Transporter analyses must exclude NULL or blank trip_transporter_name and require at least 5 trips for ranking.
3. Route fields: indent_ROUTE / route_name_derived hold canonical lane IDs; route_name is human-readable.
4. Alert metrics come from "Total Long Stoppage Alerts", "Total Route Deviation Alerts", and sta_breached_alert.
5. Trip lifecycle timestamps: trip_created_at, trip_closed_at, epod_created_at; use these for date filters.
`;
}
