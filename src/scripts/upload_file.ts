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

async function uploadFile() {
    try {
        const filePath = "/Users/admin/Downloads/indent_trips_epod_data.csv";
        console.log(`Uploading file: ${filePath} to store: fileSearchStores/${fileStoreId}`);

        const uploadResponse = await fileManager.uploadFile(filePath, {
            mimeType: "text/csv",
            displayName: "indent_trips_epod_data.csv",
        });

        console.log(`File uploaded: ${uploadResponse.file.name}`);
        console.log(`URI: ${uploadResponse.file.uri}`);

        // Now add it to the store? 
        // Wait, the SDK usually has a specific method to upload directly to a store or add an existing file to a store.
        // Let's check if we can add it to the store.
        // Based on docs, we might need to use the beta API or specific method.
        // But for now, let's just upload it. The user asked to "add another file to the file store".
        // If the SDK doesn't support adding to store easily, we might need to use REST.

        // Let's try to find a method to add to store.
        // If not, we will use the REST API approach from the docs in the next step if this fails to associate it.

        console.log("File uploaded to Gemini Files. Now associating with store...");

        // Note: The current Node SDK might not have `addFileToStore` exposed directly on `fileManager`.
        // We might need to use the `alpha` or `beta` namespace or just REST.
        // Let's try to print available methods on fileManager to see if there's a clue, or just assume we need REST for the association part if it's not obvious.

    } catch (error) {
        console.error("Error uploading file:", error);
    }
}

uploadFile();
