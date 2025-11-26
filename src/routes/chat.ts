import { Router, Request, Response } from "express";
import { convertToSQL, needsClarification, type ChatHistoryItem } from "../services/nlToSql.js";
import { executeQuery, initDatabase } from "../services/database.js";
import { generateNaturalResponse } from "../services/responseGenerator.js";
import { buildResultInsights } from "../services/resultSummarizer.js";
import { matchQuestion, renderTemplate } from "../utils/questionBank.js";
import { inferChart, type ChartRecommendation } from "../services/chartInference.js";

const router = Router();

interface ResponseSchema {
  summary: string;
  time_range: {
    from: string;
    to: string;
  };
  grouping: string;
  metrics: Array<{
    entity: string;
    total: number;
    delayed: number;
    delay_pct: number;
  }>;
  raw_answer: string;
  insight_summary: string;
  raw_rows: any[];
  chart?: ChartRecommendation;
}

// Initialize database on startup
(async () => {
  try {
    await initDatabase();
  } catch (error: any) {
    console.error("Failed to initialize database:", error.message);
  }
})();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, history = [] } = req.body;
    const isDemoMode = req.query.demo === 'true';

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    if (history && !Array.isArray(history)) {
      return res.status(400).json({ error: "History must be an array" });
    }

    const sanitizedHistory: ChatHistoryItem[] = (Array.isArray(history) ? history : [])
      .filter(
        (item): item is ChatHistoryItem =>
          item &&
          typeof item.content === "string" &&
          typeof item.role === "string" &&
          (item.role === "user" || item.role === "assistant")
      )
      .slice(-10);

    // Demo mode for testing (can be removed later)
    if (isDemoMode) {
      console.log("[DEMO MODE] Question:", message);
      return res.json({
        summary: "Demo mode: Backend is ready for real queries",
        time_range: { from: "2025-10-22", to: "2025-11-20" },
        grouping: "demo",
        metrics: [],
        raw_answer: "Remove ?demo=true from the URL to use real database queries"
      });
    }

    console.log(`📝 Received question: ${message}`);

    // 1) Question-bank override: try to answer using curated fixtures first
    const qbMatch = matchQuestion(message);
    if (qbMatch) {
      console.log(`🎯 Question-bank match found (score ${(qbMatch.score * 100).toFixed(0)}%, id=${qbMatch.fixture.id})`);
      let results: any[] = [];
      try {
        results = executeQuery(qbMatch.fixture.sql);
      } catch (error: any) {
        console.error("Question-bank SQL execution error:", error.message);
        // If the curated SQL somehow fails, fall back to the normal pipeline
      }

      if (results.length > 0) {
        const primaryRow = results[0] || {};
        const summaryFromTemplate = renderTemplate(qbMatch.fixture.template, primaryRow);
        const { summaryText: insightSummary, rawPreview } = buildResultInsights(message, results);
        
        // Infer chart type
        const chartResult = await inferChart(message, qbMatch.fixture.sql, results);
        const chart = chartResult.recommended_charts[0] || undefined;
        
        const response: ResponseSchema = formatResults(results, summaryFromTemplate || insightSummary, {
          insightSummary,
          rawPreview,
          chart,
        });
        console.log(`✅ Returning ${results.length} results from question-bank path`);
        return res.json(response);
      }
    }

    // 2) Normal pipeline: clarification -> NL->SQL -> DB -> insights -> NL

    // Check if question needs clarification
    const clarificationCheck = needsClarification(message);
    if (clarificationCheck.needs) {
      return res.json({
        summary: clarificationCheck.suggestion || "Could you be more specific?",
        time_range: { from: "", to: "" },
        grouping: "none",
        metrics: [],
        raw_answer: "Please provide more details to help me understand your question better."
      });
    }

    // Convert natural language to SQL
    let sqlQuery;
    try {
      sqlQuery = await convertToSQL(message, sanitizedHistory);
    } catch (error: any) {
      console.error("NL to SQL error:", error.message);
      return res.status(500).json({
        error: "Failed to understand the question",
        details: error.message
      });
    }

    // Low confidence check
    if (sqlQuery.confidence < 0.6) {
      return res.json({
        summary: `I'm not very confident about this query (${(sqlQuery.confidence * 100).toFixed(0)}% confidence). Could you rephrase?`,
        time_range: { from: "", to: "" },
        grouping: "uncertain",
        metrics: [],
        raw_answer: sqlQuery.explanation
      });
    }

    // Execute SQL query
    let results: any[];
    try {
      results = executeQuery(sqlQuery.sql);
    } catch (error: any) {
      console.error("SQL execution error:", error.message);
      return res.status(500).json({
        error: "Query execution failed",
        details: error.message
      });
    }

    const { summaryText: insightSummary, rawPreview } = buildResultInsights(message, results, sqlQuery);

    // Generate natural language response
    const naturalResponse = await generateNaturalResponse(
      message,
      insightSummary,
      sqlQuery.explanation,
      sanitizedHistory,
      rawPreview
    );

    // Infer chart type
    const chartResult = await inferChart(message, sqlQuery.sql, results);
    const chart = chartResult.recommended_charts[0] || undefined;

    // Format results into ResponseSchema
    const response: ResponseSchema = formatResults(results, naturalResponse, {
      insightSummary,
      rawPreview,
      chart,
    });

    console.log(`✅ Returning ${results.length} results with natural language response`);
    return res.json(response);

  } catch (error: any) {
    console.error("Chat endpoint error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message || "Unknown error occurred",
    });
  }
});

/**
 * Format SQL results into ResponseSchema
 */
function formatResults(
  results: any[],
  naturalSummary: string,
  options?: { insightSummary: string; rawPreview: any[]; chart?: ChartRecommendation }
): ResponseSchema {
  if (results.length === 0) {
    return {
      summary: naturalSummary,
      time_range: { from: "", to: "" },
      grouping: "none",
      metrics: [],
      raw_answer: naturalSummary,
      insight_summary: options?.insightSummary || "",
      raw_rows: [],
      chart: options?.chart
    };
  }

  // Detect if this is an aggregation query (has COUNT, total, etc.)
  const firstRow = results[0];
  const columns = Object.keys(firstRow);

  // Try to extract metrics if the query has grouping
  const metrics: ResponseSchema['metrics'] = [];

  // Check for specific columns from our delay analysis queries
  const hasDelayMetrics = columns.includes('delayed_trips') && columns.includes('total_trips');

  if (hasDelayMetrics || columns.some(col => col.toLowerCase().includes('total') || col === 'COUNT(*)')) {
    // This is a grouped aggregation
    for (const row of results.slice(0, 10)) { // Top 10 only
      const entityRaw = row[columns[0]];
      const entity =
        entityRaw === null ||
        entityRaw === undefined ||
        String(entityRaw).trim() === "" ||
        String(entityRaw).toLowerCase() === "null"
          ? "Unknown"
          : entityRaw;
      
      // Smart metric extraction
      let total = Number(row.total_trips || row.total || row['COUNT(*)'] || 0);
      let delayed = Number(row.delayed_trips || row.delayed || 0);
      let delay_pct = 0;

      if (hasDelayMetrics) {
         delay_pct = Number(row.delayed_percentage || 0);
      } else {
         delay_pct = total > 0 ? (delayed / total) * 100 : 0;
      }

      metrics.push({
        entity: String(entity),
        total: total,
        delayed: delayed,
        delay_pct: Number(delay_pct.toFixed(2))
      });
    }
  }

  return {
    summary: naturalSummary,
    time_range: extractTimeRange(results),
    grouping: metrics.length > 0 ? columns[0] : "none",
    metrics,
    raw_answer: naturalSummary,
    insight_summary: options?.insightSummary || "",
    raw_rows: options?.rawPreview || [],
    chart: options?.chart
  };
}

/**
 * Try to extract time range from results
 */
function extractTimeRange(results: any[]): { from: string; to: string } {
  if (!results || results.length === 0) {
    return { from: "", to: "" };
  }

  const firstRow = results[0];
  const dateColumns = Object.keys(firstRow).filter(k => 
    k.toLowerCase().includes('date') || k.toLowerCase().includes('_at')
  );

  if (dateColumns.length === 0) {
    return { from: "", to: "" };
  }

  // Safely extract and sort valid date strings
  const dates = results
    .map(r => {
      const val = r[dateColumns[0]];
      return val ? String(val) : "";
    })
    .filter(d => d.length >= 10) // Ensure minimal date length (YYYY-MM-DD)
    .sort();

  if (dates.length === 0) return { from: "", to: "" };

  return {
    from: dates[0].substring(0, 10),
    to: dates[dates.length - 1].substring(0, 10)
  };
}

export default router;
