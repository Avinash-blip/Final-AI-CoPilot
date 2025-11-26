import { getGeminiInstance } from "../utils/apiKeyRotation.js";
import { type ChatHistoryItem } from "./nlToSql.js";
import { findNlExample } from "../utils/nlExamples.js";

/**
 * Convert SQL results into a natural, conversational response
 */
export async function generateNaturalResponse(
    question: string,
    insightSummary: string,
    sqlExplanation: string,
    history: ChatHistoryItem[] = [],
    rawRows: any[] = []
): Promise<string> {
    try {
        const genAI = getGeminiInstance();
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 400,
            },
        });

        const nlExample = findNlExample(question);

        // Build a minimal, question-focused prompt
        // Key insight: Include the QUESTION prominently so Gemini knows what to answer
        const topResults = extractTopResults(rawRows, 5);
        
        const prompt = buildQuestionFocusedPrompt(question, topResults, nlExample);

        console.log('🤖 Generating natural language response...');
        const result = await model.generateContent(prompt);
        let response = result.response.text()?.trim() || "";

        // If empty, try ultra-minimal prompt
        if (!response) {
            console.warn('⚠️ Empty response from Gemini on first attempt, retrying with minimal prompt');
            response = await retryWithMinimalPrompt(model, question, topResults);
        }

        console.log(`✅ Natural language response: ${response.substring(0, 100)}...`);

        if (!response || response.trim().length === 0) {
            console.warn('⚠️ Empty response from Gemini, using fallback');
            return generateFallbackResponse(question, rawRows);
        }

        return response.trim();
    } catch (error: any) {
        console.error('❌ Natural language generation error:', error.message);
        return generateFallbackResponse(question, rawRows);
    }
}

/**
 * Extract top N results in a simple readable format
 */
function extractTopResults(rawRows: any[], limit: number): string {
    if (!rawRows || rawRows.length === 0) return "No data found.";
    
    const rows = rawRows.slice(0, limit);
    const columns = Object.keys(rows[0] || {});
    
    // Single value result
    if (rows.length === 1 && columns.length === 1) {
        const val = rows[0][columns[0]];
        return `Result: ${typeof val === 'number' ? val.toLocaleString() : val}`;
    }
    
    // Format as simple list
    const lines = rows.map((row, i) => {
        const parts = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return null;
            const label = col.replace(/_/g, ' ');
            const formatted = typeof val === 'number' ? val.toLocaleString() : val;
            return `${label}: ${formatted}`;
        }).filter(Boolean);
        return `${i + 1}. ${parts.join(', ')}`;
    });
    
    let result = lines.join('\n');
    if (rawRows.length > limit) {
        result += `\n(${rawRows.length - limit} more rows...)`;
    }
    return result;
}

/**
 * Build a question-focused prompt that tells Gemini exactly what to answer
 */
function buildQuestionFocusedPrompt(question: string, topResults: string, nlExample: any): string {
    const exampleStyle = nlExample 
        ? `\nExample answer style: "${nlExample.example_answer.substring(0, 100)}..."`
        : "";
    
    return `Answer this question about logistics data:

QUESTION: ${question}

DATA:
${topResults}
${exampleStyle}

Instructions:
- Answer the QUESTION directly in 2-3 sentences
- Use specific numbers from the DATA
- Be conversational, like a helpful analyst
- Do NOT mention SQL, databases, or technical terms

Answer:`;
}

/**
 * Ultra-minimal retry prompt when first attempt fails
 */
async function retryWithMinimalPrompt(model: any, question: string, topResults: string): Promise<string> {
    const minimalPrompt = `Question: ${question}

Data: ${topResults}

Write a 2-sentence answer to the question using the data above:`;

    try {
        const result = await model.generateContent(minimalPrompt);
        return result.response.text()?.trim() || "";
    } catch {
        return "";
    }
}

/**
 * Intelligent fallback response when Gemini fails
 * Analyzes SQL results and generates detailed natural language insights
 */
function generateFallbackResponse(question: string, sqlResults: any[]): string {
    if (sqlResults.length === 0) {
        return "I couldn’t find any trips that match this question in the current dataset. Try widening the date range or relaxing one of the filters (for example, remove a specific transporter or route constraint).";
    }

    const firstRow = sqlResults[0];
    const columns = Object.keys(firstRow);
    const lowerQuestion = question.toLowerCase();

    // Handle simple COUNT queries
    if (columns.includes('COUNT(*)') && columns.length === 1) {
        const count = firstRow['COUNT(*)'];
        return `There are ${count.toLocaleString()} matching trips for this question in the sample. If you’d like, I can break this down further by transporter, route, or time period.`;
    }

    // Handle alert analysis queries
    if (columns.includes('stoppage_alerts') || columns.includes('deviation_alerts')) {
        const stoppage = firstRow.stoppage_alerts || 0;
        const deviation = firstRow.deviation_alerts || 0;
        const overspeed = firstRow.overspeed_alerts || 0;
        const unloading = firstRow.unloading_alerts || 0;
        const totalTrips = firstRow.total_trips || 0;

        const totalAlerts = stoppage + deviation + overspeed + unloading;

        let response = `Here's your alert analysis:\n\n`;
        response += `Over ${totalTrips.toLocaleString()} trips analyzed, I found ${totalAlerts.toLocaleString()} total alerts:\n`;
        response += `• Long Stoppage Alerts: ${stoppage.toLocaleString()}\n`;
        response += `• Route Deviation Alerts: ${deviation.toLocaleString()}\n`;
        response += `• Overspeed Alerts: ${overspeed.toLocaleString()}\n`;
        response += `• Unloading Delay Alerts: ${unloading.toLocaleString()}\n\n`;

        // Find the most common alert type
        const alertTypes = [
            { name: 'Long Stoppage', count: stoppage },
            { name: 'Route Deviation', count: deviation },
            { name: 'Overspeed', count: overspeed },
            { name: 'Unloading Delay', count: unloading }
        ];
        const topAlert = alertTypes.sort((a, b) => b.count - a.count)[0];

        if (topAlert.count > 0) {
            response += `${topAlert.name} alerts are the most frequent (${((topAlert.count / totalAlerts) * 100).toFixed(1)}% of all alerts).`;
        }

        return response;
    }

    // Handle performance/ranking queries with on-time percentage
    if (columns.includes('ontime_pct') || columns.includes('total_trips')) {
        const top5 = sqlResults.slice(0, 5);

        let response = `Here's the transporter performance ranking (top ${top5.length} shown):\n\n`;
        top5.forEach((row, index) => {
            const entity = row.trip_transporter_name || row[columns[0]] || 'Unknown';
            const total = row.total_trips || row.total || 0;
            const ontime = row.ontime_pct || 0;
            response += `${index + 1}. ${entity}\n`;
            response += `   ${total.toLocaleString()} trips | On-Time: ${ontime.toFixed(1)}%\n\n`;
        });

        if (sqlResults.length > 5) {
            response += `...and ${sqlResults.length - 5} more transporters analyzed.`;
        }

        return response;
    }

    // Handle aggregation with grouping (transporters, routes, etc.)
    if (columns.includes('total') && sqlResults.length > 1) {
        const entityColumn = columns[0]; // First column is usually the entity name
        const top3 = sqlResults.slice(0, 3);

        let response = `Here are the top results:\n\n`;
        top3.forEach((row, index) => {
            const entity = row[entityColumn] || 'Unknown';
            const total = row.total || row.total_trips || 0;
            response += `${index + 1}. ${entity}: ${total.toLocaleString()} trips\n`;
        });

        if (sqlResults.length > 3) {
            response += `\n...and ${sqlResults.length - 3} more results.`;
        }

        return response;
    }

    // Handle delay-related queries
    if (lowerQuestion.includes('delay') && columns.some(c => c.toLowerCase().includes('alert'))) {
        const delayedCount = sqlResults.length;
        return `I found ${delayedCount.toLocaleString()} trips with delay indicators (stoppage alerts or STA breaches). These trips experienced significant delays during their journey.`;
    }

    // Handle list queries (many rows returned)
    if (sqlResults.length >= 10) {
        const sampleData = sqlResults.slice(0, 3);
        const keyColumn = columns.find(c => c.includes('name') || c.includes('id') || c.includes('route'));

        if (keyColumn) {
            const samples = sampleData.map(r => r[keyColumn]).filter(Boolean).join(', ');
            return `I found ${sqlResults.length} matching records. Here are a few examples: ${samples}${sqlResults.length > 3 ? ', and more' : ''}.`;
        }

        return `I found ${sqlResults.length} matching records for your query.`;
    }

    // Handle single row results (scalar or record)
    if (sqlResults.length === 1) {
        // Single value (e.g. count, max, min)
        if (columns.length === 1) {
            const val = firstRow[columns[0]];
            return `The answer is ${typeof val === 'number' ? val.toLocaleString() : val}.`;
        }

        // Record with multiple fields
        const details = columns.map(col => {
            const value = firstRow[col];
            if (value !== null && value !== undefined) {
                // Format column name: trip_transporter_name -> Trip Transporter Name
                const readableCol = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `• ${readableCol}: ${typeof value === 'number' ? value.toLocaleString() : value}`;
            }
            return null;
        }).filter(Boolean).join('\n');

        return `Here is the result:\n${details}`;
    }

    // Handle small result sets (2-5 rows) that didn't match other patterns
    if (sqlResults.length > 1 && sqlResults.length <= 5) {
        let response = `I found ${sqlResults.length} results:\n\n`;

        // Try to find a "name" or "id" column to use as a header
        const nameCol = columns.find(c => c.toLowerCase().includes('name') || c.toLowerCase().includes('id') || c.toLowerCase().includes('route'));

        sqlResults.forEach((row, idx) => {
            if (nameCol) {
                const name = row[nameCol];
                const otherCols = columns.filter(c => c !== nameCol).map(c => {
                    const val = row[c];
                    return `${c.replace(/_/g, ' ')}: ${val}`;
                }).join(', ');
                response += `${idx + 1}. ${name} (${otherCols})\n`;
            } else {
                // Just list values
                const vals = columns.map(c => `${c}: ${row[c]}`).join(', ');
                response += `${idx + 1}. ${vals}\n`;
            }
        });
        return response;
    }

    // Default fallback for larger sets
    const sampleCols = columns.slice(0, 3).join(', ');
    return `I found ${sqlResults.length} results. The data includes ${sampleCols} and more.`;
}
