#!/bin/bash
set -e

echo "🚀 Setting up SQLite database for AI Ops Copilot..."

DB_PATH="data/trips.db"
CSV="data/indent_trips_epod_data.csv"

# Check if CSV file exists
if [ ! -f "$CSV" ]; then
    echo "❌ Error: $CSV not found"
    exit 1
fi

# Remove existing database if it exists
if [ -f "$DB_PATH" ]; then
    echo "🗑️  Removing existing database..."
    rm "$DB_PATH"
fi

echo "📊 Creating database and importing data from $CSV..."

# Generate dynamic indexes from schema (1).md
echo "🔍 Generating indexes from schema..."
INDEXES=$(node --loader ts-node/esm src/scripts/generate_indexes.ts | grep "CREATE INDEX")

sqlite3 "$DB_PATH" <<EOF
.mode csv
.headers on
.timeout 30000

-- Import the single source sheet into trips_full
.import "$CSV" trips_full

-- Apply dynamic indexes
$INDEXES

-- Verify data
SELECT 'trips_full rows: ' || COUNT(*) FROM trips_full;

.quit
EOF

echo "✅ Database setup complete!"
echo "📍 Database location: $DB_PATH"
