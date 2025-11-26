import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, "../../data/trips.db");
const MAX_RESULTS = 1000;

// Dangerous SQL keywords that should never appear in queries
const DANGEROUS_KEYWORDS = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE',
    'REPLACE', 'ATTACH', 'DETACH', 'PRAGMA'
];

let SQL: any;
let db: any | null = null;
let dbInitPromise: Promise<void> | null = null;

/**
 * Initialize database connection
 */
export async function initDatabase(): Promise<void> {
    if (db) return;

    if (!dbInitPromise) {
        dbInitPromise = (async () => {
            try {
                SQL = await initSqlJs();
                const buffer = fs.readFileSync(DB_PATH);
                db = new SQL.Database(buffer);
                console.log(`✅ Database loaded: ${DB_PATH}`);
            } catch (error: any) {
                console.error('❌ Database initialization failed:', error.message);
                dbInitPromise = null;
                throw new Error(`Database initialization failed: ${error.message}`);
            }
        })();
    }

    await dbInitPromise;
}

/**
 * Validate SQL query for safety
 */
function validateQuery(sql: string): { safe: boolean; reason?: string } {
    const upperSQL = sql.toUpperCase();

    // Check for dangerous keywords
    for (const keyword of DANGEROUS_KEYWORDS) {
        // Use word boundaries to avoid matching substrings (e.g., CREATE in created_at)
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(upperSQL)) {
            return { safe: false, reason: `Dangerous keyword detected: ${keyword}` };
        }
    }

    // Must be a SELECT query
    if (!upperSQL.trim().startsWith('SELECT')) {
        return { safe: false, reason: 'Only SELECT queries are allowed' };
    }

    // Check for semicolons (multiple statements)
    const semicolons = (sql.match(/;/g) || []).length;
    if (semicolons > 1) {
        return { safe: false, reason: 'Multiple statements not allowed' };
    }

    return { safe: true };
}

/**
 * Execute a safe SQL query
 */
export function executeQuery(sql: string): any[] {
    if (!db) {
        throw new Error('Database not initialized');
    }

    // Validate query safety
    const validation = validateQuery(sql);
    if (!validation.safe) {
        throw new Error(`Query validation failed: ${validation.reason}`);
    }

    try {
        // Add LIMIT if not present
        const upperSQL = sql.toUpperCase();
        let finalSQL = sql;
        if (!upperSQL.includes('LIMIT')) {
            finalSQL = `${sql.trim().replace(/;?\s*$/, '')} LIMIT ${MAX_RESULTS}`;
        }

        console.log(`📊 Executing query: ${finalSQL.substring(0, 100)}...`);

        const startTime = Date.now();
        const results = db.exec(finalSQL);
        const duration = Date.now() - startTime;

        if (results.length === 0) {
            console.log(`✅ Query completed in ${duration}ms, returned 0 rows`);
            return [];
        }

        // Convert sql.js result format to array of objects
        const [result] = results;
        const { columns, values } = result;
        const rows = values.map((row: any[]) => {
            const obj: any = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });
            return obj;
        });

        console.log(`✅ Query completed in ${duration}ms, returned ${rows.length} rows`);
        return rows;
    } catch (error: any) {
        console.error('❌ Query execution error:', error.message);
        throw new Error(`Query execution failed: ${error.message}`);
    }
}

/**
 * Get database schema information
 */
export function getSchema(): { tables: string[]; columns: Record<string, string[]> } {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = tablesResult[0]?.values.map((row: any[]) => row[0]) || [];

    const columns: Record<string, string[]> = {};
    for (const table of tables) {
        const tableInfoResult = db.exec(`PRAGMA table_info(${table})`);
        if (tableInfoResult[0]) {
            columns[table] = tableInfoResult[0].values.map((row: any[]) => row[1]);
        }
    }

    return { tables, columns };
}

/**
 * Test database connection
 */
export function testConnection(): boolean {
    try {
        if (!db) return false;
        const result = db.exec('SELECT 1 as test');
        return result.length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        console.log('📴 Database connection closed');
    }
}
