import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const systemPrompt = `Answer questions using only information from the uploaded files. 
Provide specific data from the files in your response.
Always respond in valid JSON format matching this schema:

{
  "summary": "Brief answer to the question",
  "time_range": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "grouping": "dimension used (transporter_name, route_name, etc.)",
  "metrics": [
    {
      "entity": "Name of entity",
      "total": 0,
      "delayed": 0,
      "delay_pct": 0.0
    }
  ],
  "raw_answer": "Detailed explanation"
}`;

export async function askGemini(message: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
      temperature: 0.2,
      candidateCount: 1,
    },
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: message }],
      },
    ],
  });

  return result.response.text();
}
