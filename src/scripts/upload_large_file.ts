import "dotenv/config";
import fs from "fs";
import { stat } from "fs/promises";

const apiKey = process.env.GEMINI_API_KEY;
const fileStoreId = process.env.FILE_SEARCH_STORE_NAME;
const filePath = "/Users/admin/Downloads/indent_trips_epod_data.csv";
const displayName = "indent_trips_epod_data.csv";
const mimeType = "text/csv";

if (!apiKey || !fileStoreId) {
    console.error("Missing API Key or File Store ID");
    process.exit(1);
}

async function uploadLargeFile() {
    try {
        const stats = await stat(filePath);
        const numBytes = stats.size;
        console.log(`File size: ${numBytes} bytes`);

        const storeName = `fileSearchStores/${fileStoreId}`;
        const initiateUrl = `https://generativelanguage.googleapis.com/upload/v1beta/${storeName}:uploadToFileSearchStore?key=${apiKey}`;

        console.log("Initiating resumable upload...");
        const initResponse = await fetch(initiateUrl, {
            method: "POST",
            headers: {
                "X-Goog-Upload-Protocol": "resumable",
                "X-Goog-Upload-Command": "start",
                "X-Goog-Upload-Header-Content-Length": numBytes.toString(),
                "X-Goog-Upload-Header-Content-Type": mimeType,
                "Content-Type": "application/json",
            },
        });

        if (!initResponse.ok) {
            const text = await initResponse.text();
            throw new Error(`Failed to initiate upload: ${initResponse.status} ${initResponse.statusText} - ${text}`);
        }

        const uploadUrl = initResponse.headers.get("x-goog-upload-url");
        if (!uploadUrl) {
            throw new Error("Did not receive x-goog-upload-url header");
        }
        console.log("Upload URL obtained.");

        console.log("Uploading file stream...");
        // Node.js fetch accepts a stream as body
        const fileStream = fs.createReadStream(filePath);

        // @ts-ignore - fetch body types are strict but stream works in Node
        const uploadResponse = await fetch(uploadUrl, {
            method: "POST", // Resumable upload actual transfer is typically PUT or POST depending on command. The docs example used curl default which is POST for data-binary? No, curl usually PUTs if told? 
            // The bash script used curl "URL" ... which defaults to POST if data is present?
            // Wait, the curl command in the docs:
            // curl "${UPLOAD_URL}" -H "Content-Length: ..." -H "X-Goog-Upload-Command: upload, finalize" --data-binary "@file"
            // curl uses POST by default when data is attached.
            headers: {
                "Content-Length": numBytes.toString(),
                "X-Goog-Upload-Offset": "0",
                "X-Goog-Upload-Command": "upload, finalize",
            },
            body: fs.createReadStream(filePath) as any, // Cast to any to avoid TS issues with stream body
        });

        if (!uploadResponse.ok) {
            const text = await uploadResponse.text();
            throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText} - ${text}`);
        }

        const result = await uploadResponse.json();
        console.log("Upload complete!");
        console.log("Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

uploadLargeFile();
