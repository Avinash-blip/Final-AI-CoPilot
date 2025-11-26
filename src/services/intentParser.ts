import { getColumnNames } from "../utils/contextCatalog.js";

interface IntentMatch {
  sql: string;
  explanation: string;
  confidence: number;
}

// Helper to sanitize and wrap column names
function escapeCol(col: string): string {
  return `"${col}"`;
}

export function parseIntent(question: string): IntentMatch | null {
  const lowerQ = question.toLowerCase();
  const columns = getColumnNames();

  // 1. COUNT TOTAL (e.g., "How many trips...", "Total shipments...")
  if (
    (lowerQ.includes("how many") || lowerQ.includes("total") || lowerQ.includes("count")) &&
    (lowerQ.includes("trip") || lowerQ.includes("shipment")) &&
    !lowerQ.includes("by") && !lowerQ.includes("per") && !lowerQ.includes("top")
  ) {
    return {
      sql: `SELECT COUNT(*) as total_trips FROM trips_full WHERE trip_closed_at >= date('now', '-30 days')`,
      explanation: "Counting total trips from the last 30 days.",
      confidence: 0.95,
    };
  }

  // 2. TOP N RANKING (e.g., "Top 5 transporters", "Busiest routes")
  if (lowerQ.includes("top") || lowerQ.includes("busiest") || lowerQ.includes("highest")) {
    const limitMatch = lowerQ.match(/top\s+(\d+)/);
    const limit = limitMatch ? limitMatch[1] : "5";
    
    let groupCol = "trip_transporter_name";
    if (lowerQ.includes("route") || lowerQ.includes("lane")) groupCol = "indent_ROUTE";
    if (lowerQ.includes("vehicle")) groupCol = "VEHICLE_LABEL";
    if (lowerQ.includes("origin") || lowerQ.includes("from")) groupCol = "consignor_branch_name"; // Approximate origin

    return {
      sql: `SELECT ${escapeCol(groupCol)}, COUNT(*) as total_trips 
            FROM trips_full 
            WHERE trip_closed_at >= date('now', '-30 days') AND ${escapeCol(groupCol)} IS NOT NULL 
            GROUP BY ${escapeCol(groupCol)} 
            ORDER BY total_trips DESC 
            LIMIT ${limit}`,
      explanation: `Ranking top ${limit} ${groupCol.replace(/_/g, " ")} by volume (last 30 days).`,
      confidence: 0.9,
    };
  }

  // 3. GROUP BY / PER (e.g., "Trips per transporter", "Volume by route")
  if (lowerQ.includes(" per ") || lowerQ.includes(" by ")) {
    let groupCol = "";
    if (lowerQ.includes("transporter")) groupCol = "trip_transporter_name";
    else if (lowerQ.includes("route") || lowerQ.includes("lane")) groupCol = "indent_ROUTE";
    else if (lowerQ.includes("vehicle")) groupCol = "VEHICLE_LABEL";
    else if (lowerQ.includes("status")) groupCol = "Trip Status";
    else if (lowerQ.includes("origin")) groupCol = "consignor_branch_name";

    if (groupCol) {
      return {
        sql: `SELECT ${escapeCol(groupCol)}, COUNT(*) as total_trips 
              FROM trips_full 
              WHERE trip_closed_at >= date('now', '-30 days') AND ${escapeCol(groupCol)} IS NOT NULL 
              GROUP BY ${escapeCol(groupCol)} 
              ORDER BY total_trips DESC 
              LIMIT 20`,
        explanation: `Breaking down trip volume by ${groupCol.replace(/_/g, " ")} (last 30 days).`,
        confidence: 0.9,
      };
    }
  }

  // 4. FILTERED COUNT (e.g., "Trips from Bangalore", "Delayed trips")
  if (lowerQ.includes("from") || lowerQ.includes("origin")) {
    const cityMatch = question.match(/from\s+([a-zA-Z]+)/i);
    if (cityMatch && cityMatch[1]) {
      const city = cityMatch[1];
      return {
        sql: `SELECT COUNT(*) as total_trips 
              FROM trips_full 
              WHERE "Loading Point Address" LIKE '%${city}%' AND trip_closed_at >= date('now', '-30 days')`,
        explanation: `Counting trips originating from ${city} (last 30 days).`,
        confidence: 0.85,
      };
    }
  }

  // 5. DELAY / SLA (e.g., "How many delayed trips?")
  if (lowerQ.includes("delay") || lowerQ.includes("late") || lowerQ.includes("sla")) {
    return {
      sql: `SELECT COUNT(*) as delayed_trips 
            FROM trips_full 
            WHERE (sta_breached_alert = 1 OR "Total Long Stoppage Alerts" > 0) 
              AND trip_closed_at >= date('now', '-30 days')`,
      explanation: "Counting trips with SLA breaches or long stoppages (last 30 days).",
      confidence: 0.9,
    };
  }

  return null;
}
