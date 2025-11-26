#!/bin/bash

# File Upload Script for Google File Search Store
# Usage: ./upload-files.sh <file_path> [file_path2] ...

API_KEY="AIzaSyAwC_qFJt-KfTXcJoufPqMqtxLxoQuiLLs"
STORE_NAME="my-store-h97ldg3oz3zp"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1> [file2] ..."
    echo "Example: $0 ~/Downloads/shipments.csv ~/Downloads/carriers.csv"
    exit 1
fi

for file_path in "$@"; do
    # Expand ~ to home directory
    file_path=$(eval echo "$file_path")
    
    if [ ! -f "$file_path" ]; then
        echo "❌ File not found: $file_path"
        continue
    fi

    filename=$(basename "$file_path")
    echo "📤 Uploading: $filename"
    
    # Step 1: Upload file
    upload_response=$(curl -s -X POST \
        "https://generativelanguage.googleapis.com/v1beta/files?key=$API_KEY" \
        -H "Content-Type: multipart/form-data" \
        -F "file=@$file_path")
    
    file_name=$(echo "$upload_response" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$file_name" ]; then
        echo "❌ Failed to upload $filename"
        echo "Response: $upload_response"
        continue
    fi
    
    echo "✅ File uploaded: $file_name"
    
    # Step 2: Add file to store
    add_response=$(curl -s -X POST \
        "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/$STORE_NAME/files?key=$API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"file\": {\"name\": \"$file_name\"}}")
    
    if echo "$add_response" | grep -q "error"; then
        echo "❌ Failed to add $filename to store"
        echo "Response: $add_response"
    else
        echo "✅ Added to store: $filename"
    fi
    
    echo ""
done

echo "🎉 Upload complete!"
