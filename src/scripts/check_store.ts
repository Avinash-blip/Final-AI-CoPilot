import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;
const fileStoreId = process.env.FILE_SEARCH_STORE_NAME;

async function listStoreFiles() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/fileSearchStores/${fileStoreId}/chunks?key=${apiKey}`;

        console.log("Fetching chunks from store...");
        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Store contents:");
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

listStoreFiles();
