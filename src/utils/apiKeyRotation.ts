import { GoogleGenerativeAI } from "@google/generative-ai";

// Collect all configured API keys (supports 1..n keys)
const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
].filter((key): key is string => Boolean(key));

if (apiKeys.length === 0) {
    throw new Error("No Gemini API keys configured. Set GEMINI_API_KEY (and optional _2, _3...).");
}

// Instantiate a client per key
const genAIClients = apiKeys.map((key, index) => {
    console.log(`🔐 Loaded Gemini API key ${index + 1}`);
    return new GoogleGenerativeAI(key);
});

let requestCounter = 0;

/**
 * Returns the next Gemini client in round-robin order.
 * If only one key is configured, always returns that client.
 */
export function getGeminiInstance(): GoogleGenerativeAI {
    const client = genAIClients[requestCounter % genAIClients.length];
    requestCounter += 1;
    if (genAIClients.length > 1) {
        console.log(`🔑 Using API key ${((requestCounter - 1) % genAIClients.length) + 1}`);
    }
    return client;
}

/**
 * Reset counter (useful for testing)
 */
export function resetRotation() {
    requestCounter = 0;
}
