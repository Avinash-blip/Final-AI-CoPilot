import { getGeminiInstance } from "../utils/apiKeyRotation.js";

/**
 * Chart Inference Layer
 * Analyzes SQL result tables and recommends appropriate visualizations
 */

export interface ColumnMeta {
  name: string;
  type: "string" | "number" | "date" | "boolean";
}

export interface ChartRecommendation {
  chart_type: 
    | "bar" 
    | "horizontal_bar" 
    | "line" 
    | "area" 
    | "pie" 
    | "donut" 
    | "stacked_bar" 
    | "heatmap" 
    | "scatter" 
    | "table_only" 
    | "metric_card" 
    | "multi_metric_card";
  x?: string;
  y?: string;
  y_columns?: string[];
  group_by?: string | null;
  reason: string;
}

export interface ChartInferenceResult {
  recommended_charts: ChartRecommendation[];
}

/**
 * Infer column types from actual data
 */
function inferColumnTypes(rows: any[]): ColumnMeta[] {
  if (!rows || rows.length === 0) return [];
  
  const firstRow = rows[0];
  const columns = Object.keys(firstRow);
  
  return columns.map(name => {
    const sampleValues = rows.slice(0, 10).map(r => r[name]).filter(v => v !== null && v !== undefined);
    
    // Check if it's a date column
    const lowerName = name.toLowerCase();
    if (lowerName.includes('date') || lowerName.includes('_at') || lowerName.includes('time')) {
      return { name, type: "date" as const };
    }
    
    // Check actual values
    const firstValue = sampleValues[0];
    if (typeof firstValue === "number") {
      return { name, type: "number" as const };
    }
    
    if (typeof firstValue === "boolean") {
      return { name, type: "boolean" as const };
    }
    
    // Check if string values look like dates
    if (typeof firstValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(firstValue)) {
      return { name, type: "date" as const };
    }
    
    return { name, type: "string" as const };
  });
}

/**
 * Count distinct values for a column
 */
function countDistinct(rows: any[], columnName: string): number {
  const values = new Set(rows.map(r => r[columnName]));
  return values.size;
}

/**
 * Detect user intent from question keywords
 */
function detectIntent(question: string): string[] {
  const lower = question.toLowerCase();
  const intents: string[] = [];
  
  if (lower.includes("trend") || lower.includes("over time") || lower.includes("across days") || lower.includes("daily") || lower.includes("weekly")) {
    intents.push("time_series");
  }
  if (lower.includes("share") || lower.includes("distribution") || lower.includes("split") || lower.includes("percentage of") || lower.includes("breakdown")) {
    intents.push("distribution");
  }
  if (lower.includes("ranking") || lower.includes("top") || lower.includes("compare") || lower.includes("highest") || lower.includes("most")) {
    intents.push("ranking");
  }
  if (lower.includes("correlation") || lower.includes("relationship") || lower.includes("vs")) {
    intents.push("correlation");
  }
  if (lower.includes("heatmap") || lower.includes("matrix") || lower.includes("grid")) {
    intents.push("heatmap");
  }
  
  return intents;
}

/**
 * Rule-based chart inference (deterministic, no hallucination)
 */
export function inferChartFromData(
  question: string,
  rows: any[]
): ChartInferenceResult {
  // Handle empty data
  if (!rows || rows.length === 0) {
    return {
      recommended_charts: [{
        chart_type: "table_only",
        reason: "No data available to visualize."
      }]
    };
  }

  const columns = inferColumnTypes(rows);
  const intents = detectIntent(question);
  
  // Classify columns
  const categoricalCols = columns.filter(c => c.type === "string");
  const numericCols = columns.filter(c => c.type === "number");
  const dateCols = columns.filter(c => c.type === "date");
  
  const recommendations: ChartRecommendation[] = [];

  // Rule: Single row with single numeric value → Metric Card
  if (rows.length === 1 && numericCols.length === 1 && categoricalCols.length === 0) {
    recommendations.push({
      chart_type: "metric_card",
      y: numericCols[0].name,
      reason: "Single numeric value - best displayed as a metric card."
    });
    return { recommended_charts: recommendations };
  }

  // Rule: Single row with multiple numeric values → Multi-Metric Card
  if (rows.length === 1 && numericCols.length > 1) {
    recommendations.push({
      chart_type: "multi_metric_card",
      y_columns: numericCols.map(c => c.name),
      reason: "Single row with multiple metrics - displayed as metric cards."
    });
    return { recommended_charts: recommendations };
  }

  // Rule: Time dimension + numeric metric → Line Chart
  if (dateCols.length >= 1 && numericCols.length >= 1) {
    if (intents.includes("time_series") || !intents.length) {
      if (numericCols.length === 1) {
        recommendations.push({
          chart_type: "line",
          x: dateCols[0].name,
          y: numericCols[0].name,
          reason: "Time dimension with numeric metric - line chart shows trend."
        });
      } else {
        recommendations.push({
          chart_type: "line",
          x: dateCols[0].name,
          y_columns: numericCols.map(c => c.name),
          reason: "Time dimension with multiple metrics - multi-line chart."
        });
      }
    }
  }

  // Rule: 1 Categorical + 1 Numeric → Bar Chart
  if (categoricalCols.length === 1 && numericCols.length >= 1 && dateCols.length === 0) {
    const cardinality = countDistinct(rows, categoricalCols[0].name);
    
    // Check for percentage columns (pie/donut candidates)
    const pctCol = numericCols.find(c => 
      c.name.toLowerCase().includes('percent') || 
      c.name.toLowerCase().includes('pct') ||
      c.name.toLowerCase().includes('percentage')
    );
    
    if (pctCol && cardinality <= 8 && intents.includes("distribution")) {
      recommendations.push({
        chart_type: "donut",
        x: categoricalCols[0].name,
        y: pctCol.name,
        reason: "Percentage data with few categories - donut chart shows distribution."
      });
    }
    
    // Horizontal bar for many categories
    if (cardinality > 8) {
      recommendations.push({
        chart_type: "horizontal_bar",
        x: categoricalCols[0].name,
        y: numericCols[0].name,
        reason: `${cardinality} categories - horizontal bar is more readable.`
      });
    } else {
      recommendations.push({
        chart_type: "bar",
        x: categoricalCols[0].name,
        y: numericCols[0].name,
        reason: "Categorical dimension with numeric metric - bar chart for comparison."
      });
    }
  }

  // Rule: 1 Categorical + Multiple Numeric → Stacked/Grouped Bar
  if (categoricalCols.length === 1 && numericCols.length > 1 && dateCols.length === 0) {
    recommendations.push({
      chart_type: "stacked_bar",
      x: categoricalCols[0].name,
      y_columns: numericCols.map(c => c.name),
      reason: "Multiple metrics per category - stacked bar shows composition."
    });
  }

  // Rule: 2 Categorical + 1 Numeric → Heatmap or Grouped Bar
  if (categoricalCols.length === 2 && numericCols.length === 1) {
    const card1 = countDistinct(rows, categoricalCols[0].name);
    const card2 = countDistinct(rows, categoricalCols[1].name);
    
    if (card1 * card2 <= 50 && intents.includes("heatmap")) {
      recommendations.push({
        chart_type: "heatmap",
        x: categoricalCols[0].name,
        y: categoricalCols[1].name,
        group_by: numericCols[0].name,
        reason: "Two categorical dimensions - heatmap shows matrix comparison."
      });
    } else {
      recommendations.push({
        chart_type: "horizontal_bar",
        x: categoricalCols[0].name,
        y: numericCols[0].name,
        group_by: categoricalCols[1].name,
        reason: "Two categorical dimensions - grouped bar chart."
      });
    }
  }

  // Rule: 2 Numeric columns (no categorical) → Scatter
  if (numericCols.length === 2 && categoricalCols.length === 0 && dateCols.length === 0) {
    if (intents.includes("correlation")) {
      recommendations.push({
        chart_type: "scatter",
        x: numericCols[0].name,
        y: numericCols[1].name,
        reason: "Two numeric dimensions - scatter plot shows relationship."
      });
    }
  }

  // Fallback: Table only
  if (recommendations.length === 0) {
    recommendations.push({
      chart_type: "table_only",
      reason: "Data structure doesn't fit standard chart patterns - showing as table."
    });
  }

  return { recommended_charts: recommendations };
}

/**
 * Main entry point for chart inference
 * Uses rule-based inference first, falls back to Gemini for edge cases
 */
export async function inferChart(
  question: string,
  sql: string,
  rows: any[]
): Promise<ChartInferenceResult> {
  // Use rule-based inference (deterministic, fast)
  const result = inferChartFromData(question, rows);
  
  // Log the recommendation
  if (result.recommended_charts.length > 0) {
    const chart = result.recommended_charts[0];
    console.log(`📊 Chart inference: ${chart.chart_type} (${chart.reason})`);
  }
  
  return result;
}

/**
 * Use Gemini for complex chart inference (optional, for edge cases)
 * Only called when rule-based inference is uncertain
 */
export async function inferChartWithGemini(
  question: string,
  columns: ColumnMeta[],
  sampleRows: any[]
): Promise<ChartInferenceResult> {
  try {
    const genAI = getGeminiInstance();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 500,
      },
    });

    const input = {
      columns: columns.map(c => ({ name: c.name, type: c.type })),
      rows: sampleRows.slice(0, 5).map(r => Object.values(r)),
      row_count: sampleRows.length
    };

    const prompt = `You are a Chart-Inference Engine. Analyze this SQL result and recommend the best chart.

USER QUESTION: "${question}"

DATA:
${JSON.stringify(input, null, 2)}

CHART TYPES (pick one): bar, horizontal_bar, line, area, pie, donut, stacked_bar, heatmap, scatter, table_only, metric_card, multi_metric_card

RULES:
- pie/donut: only if <8 categories
- line: only if there's a time/date column
- scatter: only if 2 numeric columns
- metric_card: only if 1 row, 1 number
- horizontal_bar: if >8 categories

Output ONLY valid JSON:
{
  "recommended_charts": [
    {
      "chart_type": "...",
      "x": "column_name",
      "y": "column_name",
      "reason": "..."
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim() || "";
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback to rule-based
    return inferChartFromData(question, sampleRows);
  } catch (error) {
    console.error("Chart inference with Gemini failed:", error);
    return inferChartFromData(question, sampleRows);
  }
}
