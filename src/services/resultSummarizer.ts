import { SQLQuery } from "./nlToSql.js";

interface ResultInsights {
  summaryText: string;
  rawPreview: any[];
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-IN");

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }
  if (Math.abs(value) >= 100) {
    return NUMBER_FORMAT.format(Math.round(value));
  }
  return value.toFixed(2);
}

function pickMetricColumn(row: Record<string, any>): string | null {
  if (!row) return null;
  const preference = ["total_trips", "total", "count", "COUNT(*)", "delay_pct", "ontime_pct", "delayed"];
  for (const key of preference) {
    const match = Object.keys(row).find((col) => col.toLowerCase() === key.toLowerCase());
    if (match && typeof row[match] === "number") {
      return match;
    }
  }
  const numeric = Object.keys(row).find((col) => typeof row[col] === "number");
  return numeric ?? null;
}

function pickEntityColumn(row: Record<string, any>, metricColumn: string | null): string | null {
  if (!row) return null;
  const preference = ["trip_transporter_name", "transporter_name", "indent_transporter_name", "route_name", "indent_route"];
  for (const key of preference) {
    const match = Object.keys(row).find((col) => col.toLowerCase() === key.toLowerCase());
    if (match && match !== metricColumn) {
      const value = row[match];
      if (typeof value === "string") {
        return match;
      }
    }
  }
  const firstString = Object.keys(row).find(
    (col) => col !== metricColumn && typeof row[col] === "string"
  );
  return firstString ?? null;
}

function normalizeEntity(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (!str || str.toLowerCase() === "null") return "";
  return str;
}

function summarizeTopEntities(
  rows: any[],
  metricColumn: string | null,
  entityColumn: string | null
): string | null {
  if (!metricColumn || !entityColumn) return null;

  const cleaned = rows
    .filter((row) => typeof row[metricColumn] === "number")
    .map((row) => ({
      entity: normalizeEntity(row[entityColumn]),
      metric: row[metricColumn] as number,
    }))
    .filter((row) => row.entity);

  if (!cleaned.length) return null;

  cleaned.sort((a, b) => b.metric - a.metric);
  const topFive = cleaned.slice(0, 5);
  const bullets = topFive
    .map((row, idx) => `${idx + 1}. ${row.entity}: ${formatNumber(row.metric)}`)
    .join("; ");

  return `Top performers (${entityColumn} by ${metricColumn}): ${bullets}.`;
}

function summarizeNulls(rows: any[], entityColumn: string | null): string | null {
  if (!entityColumn) return null;
  const nullCount = rows.filter((row) => !normalizeEntity(row[entityColumn])).length;
  if (!nullCount) return null;
  const percent = ((nullCount / rows.length) * 100).toFixed(1);
  return `${nullCount} rows (~${percent}%) missing ${entityColumn}.`;
}

function summarizeNumericSpread(rows: any[], metricColumn: string | null): string | null {
  if (!metricColumn) return null;
  const metrics = rows
    .map((row) => row[metricColumn])
    .filter((value) => typeof value === "number") as number[];
  if (metrics.length < 2) return null;
  const max = Math.max(...metrics);
  const min = Math.min(...metrics);
  if (min === max) return null;
  const ratio = (max / (min || 1)).toFixed(1);
  return `${metricColumn} ranges from ${formatNumber(min)} to ${formatNumber(max)}, a ${ratio}x spread.`;
}

function inferEntityType(entityColumn: string | null): string {
  if (!entityColumn) return "entity";
  const col = entityColumn.toLowerCase();
  if (col.includes("transporter")) return "transporter";
  if (col.includes("route")) return "route";
  if (col.includes("consignor")) return "consignor";
  if (col.includes("vehicle")) return "vehicle";
  return "entity";
}

function inferMetricLabel(metricColumn: string | null): string {
  if (!metricColumn) return "value";
  const col = metricColumn.toLowerCase();
  if (col.includes("delay")) return "delayed trips";
  if (col.includes("ontime") || col.includes("on_time")) return "on-time performance";
  if (col.includes("trip") || col.includes("total")) return "trip volume";
  if (col.includes("avg") || col.includes("average") || col.includes("transit_time")) {
    return "average transit time";
  }
  return metricColumn;
}

function extractTimeWindow(rows: any[]): string | null {
  if (!rows.length) return null;
  const sample = rows[0] || {};
  const dateColumns = Object.keys(sample).filter((key) =>
    key.toLowerCase().includes("date") || key.toLowerCase().endsWith("_at")
  );
  if (!dateColumns.length) return null;

  const col = dateColumns[0];
  const values = rows
    .map((r) => r[col])
    .filter((v) => typeof v === "string" && v.length >= 10)
    .sort();

  if (!values.length) return null;
  const from = values[0].substring(0, 10);
  const to = values[values.length - 1].substring(0, 10);
  if (from === to) return `TIME_WINDOW: ${from}`;
  return `TIME_WINDOW: ${from} → ${to}`;
}

export function buildResultInsights(question: string, rows: any[], sqlQuery?: SQLQuery): ResultInsights {
  if (!rows || !rows.length) {
    return {
      summaryText: `QUESTION: ${question}\nROWS_RETURNED: 0\nINSIGHT: No matching records were found. Ask the user to adjust filters or date ranges.`,
      rawPreview: [],
    };
  }

  const rowCount = rows.length;
  const firstRow = rows[0] || {};
  const columns = Object.keys(firstRow);
  const metricColumn = pickMetricColumn(firstRow);
  const entityColumn = pickEntityColumn(firstRow, metricColumn);

  const entityType = inferEntityType(entityColumn);
  const metricLabel = inferMetricLabel(metricColumn);

  const parts: string[] = [];
  parts.push(`QUESTION: ${question}`);
  parts.push(`ENTITY_TYPE: ${entityType}${entityColumn ? ` (${entityColumn})` : ""}`);
  parts.push(`METRIC: ${metricLabel}${metricColumn ? ` (${metricColumn})` : ""}`);
  parts.push(`ROWS_RETURNED: ${rowCount}`);
  parts.push(`COLUMNS_SAMPLED: ${columns.slice(0, 6).join(", ")}`);

  const timeWindow = extractTimeWindow(rows);
  if (timeWindow) {
    parts.push(timeWindow);
  }

  const topSummary = summarizeTopEntities(rows, metricColumn, entityColumn);
  if (topSummary) parts.push(topSummary);

  const nullSummary = summarizeNulls(rows, entityColumn);
  if (nullSummary) parts.push(nullSummary);

  const spreadSummary = summarizeNumericSpread(rows, metricColumn);
  if (spreadSummary) parts.push(spreadSummary);

  if (sqlQuery?.explanation) {
    parts.push(`SQL intent: ${sqlQuery.explanation}`);
  }

  return {
    summaryText: parts.join("\n"),
    rawPreview: rows.slice(0, 20),
  };
}
