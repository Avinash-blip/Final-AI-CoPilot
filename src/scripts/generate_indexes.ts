import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.resolve(__dirname, '../../data/schema (1).md');
const DB_SETUP_PATH = path.resolve(__dirname, '../../scripts/setup_database.sh');

function generateIndexes() {
    try {
        // Read schema file
        const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        const lines = schemaContent.split('\n').filter(line => line.trim().length > 0);
        
        // Skip header
        const dataLines = lines.filter(line => !line.startsWith('Sno'));
        
        const indexes: string[] = [];
        
        dataLines.forEach(line => {
            const parts = line.split('\t').map(p => p.trim());
            if (parts.length >= 2) {
                const rawCol = parts[1];
                // Unescape column names (remove backslashes before underscores)
                const column = rawCol.replace(/\\_/g, '_');
                
                // Determine if we should index this column
                // Index IDs, names, dates, status, and metrics that might be filtered/grouped
                const shouldIndex = 
                    column.includes('_id') || 
                    column.includes('name') || 
                    column.includes('_at') || 
                    column.includes('date') || 
                    column.includes('Status') || 
                    column.includes('alert') ||
                    column.includes('ROUTE');
                    
                if (shouldIndex) {
                    // Handle columns with spaces by quoting them
                    const safeCol = column.includes(' ') ? `"${column}"` : column;
                    const indexName = `idx_${column.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    indexes.push(`CREATE INDEX IF NOT EXISTS ${indexName} ON trips_full(${safeCol});`);
                }
            }
        });
        
        return indexes.join('\n');
    } catch (error) {
        console.error('Error generating indexes:', error);
        return '';
    }
}

const indexesSql = generateIndexes();
console.log(indexesSql);
