# AI Ops Copilot Backend

This is the backend for the AI Ops Copilot, built with Node.js, Express, and Google Gemini 1.5 Pro.

## Prerequisites

- Node.js (v18+)
- Google AI Studio API Key
- A File Search Store created in Google AI Studio

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configure Environment**
    Copy `.env.example` to `.env` and fill in your values:
    ```bash
    cp .env.example .env
    ```
    - `GEMINI_API_KEY`: Your Gemini API key.
    - `FILE_SEARCH_STORE_NAME`: The resource name of your File Search store (e.g., `projects/.../locations/.../corpora/...` or just the ID if using the simplified SDK format, but typically it's the full resource name or the name you gave it if using a specific setup. Ensure it matches what the code expects: `fileSearchStores/${fileStore}`).
    *Note: The code currently prepends `fileSearchStores/` to the variable, so just provide the ID.*

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

4.  **Build and Start Production Server**
    ```bash
    npm run build
    npm start
    ```

## API Endpoints

### POST /api/chat

Accepts a natural language message and returns a structured JSON response.

**Request:**
```json
{
  "message": "Show me delayed shipments today",
  "history": []
}
```

**Response:**
```json
{
  "summary": "...",
  "time_range": { "from": "...", "to": "..." },
  "grouping": "...",
  "metrics": [
    { "entity": "...", "total": 0, "delayed": 0, "delay_pct": 0 }
  ],
  "raw_answer": "..."
}
```
