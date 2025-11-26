import { initDatabase, getSchema, closeDatabase } from "../services/database.js";

async function run() {
    try {
        await initDatabase();
        const schema = getSchema();
        console.log("SCHEMA:", JSON.stringify(schema, null, 2));
        closeDatabase();
    } catch (error) {
        console.error(error);
    }
}

run();

