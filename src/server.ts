import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import chatRouter from "./routes/chat.js";
import { initDatabase, testConnection } from "./services/database.js";

const PORT = process.env.PORT || 3001;
const app = express();
let databaseReady = false;

app.use(cors());
app.use(bodyParser.json());

app.get("/health", (_req, res) => {
  const dbStatus = testConnection();
  res.json({
    status: databaseReady && dbStatus ? "ok" : "degraded",
    database: dbStatus,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use("/api/chat", chatRouter);

async function startServer() {
  try {
    console.log("⏳ Initializing database...");
    await initDatabase();
    databaseReady = true;
    console.log("✅ Database initialized");
    app.listen(PORT, () => {
      console.log(`🚀 AI Ops Copilot backend running on port ${PORT}`);
    });
  } catch (error: any) {
    console.error("❌ Failed to initialize database:", error.message);
    process.exit(1);
  }
}

startServer();
