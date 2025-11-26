import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSchema } from "./database.js";
import { getGeminiInstance } from "../utils/apiKeyRotation.js";
import { buildContextSnippet, getBusinessRulesSummary, applyQueryGuards } from "../utils/contextCatalog.js";
import { buildKnowledgePrompt } from "../utils/knowledgeContext.js";

export type ChatHistoryItem = {
    role: "user" | "assistant";
    content: string;
};

export interface SQLQuery {
    sql: string;
    explanation: string;
    confidence: number;
}

/**
 * Fallback SQL generator for common query patterns when Gemini fails
 */
function generateFallbackSQL(question: string): SQLQuery {
    const lowerQ = question.toLowerCase();

    // Alert analysis
    if (lowerQ.includes('alert') && (lowerQ.includes('analysis') || lowerQ.includes('summary'))) {
        const days = lowerQ.match(/(\d+)\s*days?/)?.[1] || '30';
        return {
            sql: `SELECT 
                SUM("Total Long Stoppage Alerts") as stoppage_alerts,
                SUM("Total Route Deviation Alerts") as deviation_alerts,
                SUM("Total Overspeed Alerts") as overspeed_alerts,
                SUM("Total Unloading Delay Alerts") as unloading_alerts,
                COUNT(*) as total_trips
            FROM trips_full 
            WHERE trip_closed_at >= date('now', '-${days} days')`,
            explanation: `Analyzing all alert types from the last ${days} days`,
            confidence: 0.8
        };
    }

    // Delayed trips
    if (lowerQ.includes('delay') || lowerQ.includes('late')) {
        const days = lowerQ.match(/(\d+)\s*days?/)?.[1] || '7';
        return {
            sql: `SELECT COUNT(*) FROM trips_full WHERE "Total Long Stoppage Alerts" > 0 AND trip_closed_at >= date('now', '-${days} days')`,
            explanation: `Counting delayed trips from the last ${days} days`,
            confidence: 0.85
        };
    }

    // Route-wise delay analysis
    if (lowerQ.includes('route') && (lowerQ.includes('delay') || lowerQ.includes('performance'))) {
        return {
            sql: `SELECT 
                indent_ROUTE as route_name,
                COUNT(*) as total_trips,
                SUM(CASE WHEN sta_breached_alert = 0 AND "Total Long Stoppage Alerts" = 0 THEN 1 ELSE 0 END) as ontime_trips,
                SUM(CASE WHEN sta_breached_alert = 1 OR "Total Long Stoppage Alerts" > 0 THEN 1 ELSE 0 END) as delayed_trips,
                ROUND(SUM(CASE WHEN sta_breached_alert = 1 OR "Total Long Stoppage Alerts" > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as delay_pct
            FROM trips_full
            WHERE indent_ROUTE IS NOT NULL
            GROUP BY indent_ROUTE
            HAVING COUNT(*) >= 5
            ORDER BY delay_pct DESC
            LIMIT 10`,
            explanation: 'Analyzing route-wise delays (top 10 routes with highest delay %)',
            confidence: 0.9
        };
    }

    // Transporter performance/ranking queries
    if (lowerQ.includes('transporter') || lowerQ.includes('carrier')) {
        // Delay percentage by transporter
        if ((lowerQ.includes('delay') || lowerQ.includes('late')) && (lowerQ.includes('%') || lowerQ.includes('percent') || lowerQ.includes('percentage'))) {
            return {
                sql: `SELECT 
                    trip_transporter_name,
                    COUNT(*) AS total_trips,
                    SUM(CASE WHEN sta_breached_alert = 1 THEN 1 ELSE 0 END) AS delayed_trips,
                    ROUND(SUM(CASE WHEN sta_breached_alert = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS delayed_percentage
                FROM trips_full
                WHERE trip_transporter_name IS NOT NULL
                  AND DATE(trip_created_at) >= DATE('now', '-30 day')
                GROUP BY trip_transporter_name
                HAVING COUNT(*) >= 5
                ORDER BY delayed_percentage DESC
                LIMIT 20`,
                explanation: 'Calculating delay percentage by transporter. delayed_percentage = (delayed_trips / total_trips) × 100. Filtered to transporters with at least 5 trips.',
                confidence: 0.9
            };
        }

        // Check if user wants performance metrics (on-time %, ranking, etc.)
        if (lowerQ.includes('performance') || lowerQ.includes('ranking') || lowerQ.includes('ontime') || lowerQ.includes('on-time') || lowerQ.includes('on time')) {
            return {
                sql: `SELECT 
                    trip_transporter_name,
                    COUNT(*) AS total_trips,
                    SUM(CASE WHEN sta_breached_alert = 0 AND "Total Long Stoppage Alerts" = 0 THEN 1 ELSE 0 END) AS ontime_trips,
                    ROUND(SUM(CASE WHEN sta_breached_alert = 0 AND "Total Long Stoppage Alerts" = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS ontime_pct
                FROM trips_full
                WHERE trip_transporter_name IS NOT NULL
                GROUP BY trip_transporter_name
                HAVING COUNT(*) >= 10
                ORDER BY ontime_pct DESC
                LIMIT 10`,
                explanation: 'Ranking transporters by on-time performance with minimum 10 trips and null names removed',
                confidence: 0.9
            };
        }

        // Simple transporter count
        return {
            sql: `SELECT trip_transporter_name, COUNT(*) as total 
                FROM trips_full 
                WHERE trip_transporter_name IS NOT NULL 
                GROUP BY trip_transporter_name 
                ORDER BY total DESC 
                LIMIT 10`,
            explanation: 'Finding top transporters by trip count (null names removed)',
            confidence: 0.8
        };
    }

    // Default fallback
    throw new Error('Could not generate SQL for this question. Please try rephrasing.');
}

/**
 * Convert natural language question to SQL query using Gemini
 */
export async function convertToSQL(question: string, history: ChatHistoryItem[] = []): Promise<SQLQuery> {
    // Live schema snapshot from the actual SQLite database (restricted to trips_full)
    const dbSchema = getSchema();
    const tripsFullColumns = dbSchema.columns["trips_full"] || [];
    const schemaForPrompt = {
        table: "trips_full",
        columns: tripsFullColumns,
    };

    const knowledgePrompt = buildKnowledgePrompt();
    const contextSnippet = buildContextSnippet(question);
    const conversationContext = buildHistoryContext(history);

    const systemPrompt = `You are an expert SQL query generator for a logistics database.

The ONLY table you should query is "trips_full".
Do NOT use "trips", "logistics_data", or any other table name.

LIVE DATABASE SCHEMA (from SQLite, trips_full only):
${JSON.stringify(schemaForPrompt, null, 2)}

ANALYTICS KNOWLEDGE BASE (schema + metrics + business rules):
${knowledgePrompt}

COLUMN CONTEXT (Relevant to this specific question):
${contextSnippet}

IMPORTANT RULES:
1. Generate ONLY valid SELECT queries using SQLite syntax.
2. Use ONLY columns defined in the SCHEMA section above.
3. The table name is "trips_full".
4. Use the METRIC DEFINITIONS for calculations (e.g., On-Time %, Late PODs).
5. Use SQLite date functions (e.g., date('now', '-7 days')).
6. Always LIMIT results to 100 rows unless specified otherwise.
7. Return JSON with:
   {
     "sql": "the SQL query",
     "explanation": "plain English explanation of logic",
     "confidence": 0.0-1.0
   }
`;

    try {
        const genAI = getGeminiInstance(); // Rotate between API keys
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: {
                temperature: 0, // Zero temperature for deterministic SQL generation
                maxOutputTokens: 1024,
            },
        });

        const prompt = `CONVERSATION CONTEXT:
${conversationContext}

LATEST USER QUESTION:
${question}

Convert the latest question to SQL following the rules above.`;

        const result = await model.generateContent(prompt);

        // Check if response was blocked
        const promptFeedback = result.response.promptFeedback;
        if (promptFeedback && promptFeedback.blockReason) {
            console.error('❌ Gemini blocked response. Reason:', promptFeedback.blockReason);
            return generateFallbackSQL(question);
        }

        const response = result.response.text();
        console.log('📝 Raw Gemini response length:', response.length);
        console.log('📝 Raw Gemini response:', response.substring(0, 500));

        // Check for empty response
        if (!response || response.trim().length === 0) {
            console.error('❌ Gemini returned empty response, using fallback');
            return generateFallbackSQL(question);
        }

        // Try to extract JSON from response (handle markdown code blocks)
        let jsonStr = response.trim();

        // Remove markdown code blocks if present
        const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) ||
            jsonStr.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        // Try to parse
        let parsed: SQLQuery;
        try {
            parsed = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('❌ JSON parse error, using fallback. Response was:', response);
            return generateFallbackSQL(question);
        }

        // Validate the response
        if (!parsed.sql || !parsed.explanation) {
            console.error('❌ Missing required fields, using fallback. Parsed:', parsed);
            return generateFallbackSQL(question);
        }

        // Ensure confidence is between 0 and 1
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

        console.log(`🤖 Generated SQL (confidence: ${(parsed.confidence * 100).toFixed(0)}%):`, parsed.sql);

        parsed.sql = applyQueryGuards(parsed.sql);

        return parsed;
    } catch (error: any) {
        console.error('❌ NL to SQL conversion error, using fallback:', error.message);
        return generateFallbackSQL(question);
    }
}

function buildHistoryContext(history: ChatHistoryItem[]): string {
    if (!history.length) {
        return "No prior conversation.";
    }

    return history
        .slice(-6)
        .map(turn => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
        .join("\n");
}

/**
 * Simple heuristic: if question is vague, ask for clarification
 */
export function needsClarification(question: string): { needs: boolean; suggestion?: string } {
    const lowerQ = question.toLowerCase();

    // Too short
    if (question.trim().split(/\s+/).length < 3) {
        return {
            needs: true,
            suggestion: "Could you provide more details about what you're looking for?"
        };
    }

    // Too vague
    const vagueTerms = ['something', 'anything', 'stuff', 'things', 'data', 'info', 'information'];
    if (vagueTerms.some(term => lowerQ.includes(term))) {
        return {
            needs: true,
            suggestion: "Could you be more specific? For example, are you asking about transporters, routes, or delays?"
        };
    }

    return { needs: false };
}
