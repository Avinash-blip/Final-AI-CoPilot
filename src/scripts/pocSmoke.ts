import "dotenv/config";
import { initDatabase, testConnection, executeQuery } from "../services/database.js";
import { convertToSQL } from "../services/nlToSql.js";

const SAMPLE_QUESTIONS = [
  "Show me delayed trips from last week",
  "Who are the top transporters by on-time performance?",
  "Give me an alert summary for the last 30 days",
];

async function runSmokeTest() {
  console.log("🚦 Running POC smoke test...");
  await initDatabase();

  if (!testConnection()) {
    throw new Error("Database connection failed.");
  }

  for (const question of SAMPLE_QUESTIONS) {
    console.log(`\n❓ ${question}`);
    const sqlQuery = await convertToSQL(question);
    console.log(`   ↳ SQL: ${sqlQuery.sql}`);
    const rows = executeQuery(sqlQuery.sql);
    console.log(`   ↳ Rows returned: ${rows.length}`);
  }

  console.log("\n✅ Smoke test completed successfully. Backend is ready.");
}

runSmokeTest().catch((error) => {
  console.error("❌ Smoke test failed:", error);
  process.exit(1);
});


