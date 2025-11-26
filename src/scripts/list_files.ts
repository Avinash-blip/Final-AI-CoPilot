import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

const apiKey = process.env.GEMINI_API_KEY;
const fileStoreId = process.env.FILE_SEARCH_STORE_NAME;

if (!apiKey || !fileStoreId) {
    console.error("Missing API Key or File Store ID");
    process.exit(1);
}

const fileManager = new GoogleAIFileManager(apiKey);

async function listFiles() {
    try {
        console.log(`Listing files for store: fileSearchStores/${fileStoreId}`);
        // Note: The SDK might not have a direct "listFilesInStore" method exposed easily in all versions,
        // but we can try to get the store and see its files, or list all files and filter (inefficient).
        // Actually, the correct way is usually via the fileManager.listFiles() but filtering by corpus/store is tricky.
        // Let's try to get the store details first.

        // Alternative: Use the REST API via fetch if SDK is limited, but let's try SDK first.
        // The SDK for fileManager usually handles uploads. 
        // Let's try to list all files and see if we can filter or just show them.

        const response = await fileManager.listFiles();
        console.log("List Files Response:", JSON.stringify(response, null, 2));
        if (response.files) {
            for (const file of response.files) {
                console.log(`- ${file.displayName} (${file.name})`);
            }
        }

    } catch (error) {
        console.error("Error listing files:", error);
    }
}

listFiles();
