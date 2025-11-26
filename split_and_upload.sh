#!/bin/bash
set -e

source .env

INPUT_FILE="/Users/admin/Downloads/indent_trips_epod_data.csv"
OUTPUT_DIR="/tmp/csv_chunks"
CHUNK_SIZE=8000  # rows per chunk
STORE_NAME="fileSearchStores/${FILE_SEARCH_STORE_NAME}"

echo "Creating output directory..."
mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_DIR}"/*.csv

echo "Splitting CSV file into ${CHUNK_SIZE}-row chunks..."
# Get header
head -1 "${INPUT_FILE}" > "${OUTPUT_DIR}/header.txt"

# Split the file (skip header, split into chunks)
tail -n +2 "${INPUT_FILE}" | split -l ${CHUNK_SIZE} - "${OUTPUT_DIR}/chunk_"

# Add header to each chunk and rename to .csv
CHUNK_NUM=1
for chunk in "${OUTPUT_DIR}"/chunk_*; do
    if [ -f "$chunk" ]; then
        CHUNK_FILE="${OUTPUT_DIR}/indent_trips_part_$(printf "%02d" ${CHUNK_NUM}).csv"
        cat "${OUTPUT_DIR}/header.txt" "$chunk" > "${CHUNK_FILE}"
        rm "$chunk"
        echo "Created: ${CHUNK_FILE}"
        CHUNK_NUM=$((CHUNK_NUM + 1))
    fi
done

rm "${OUTPUT_DIR}/header.txt"

echo ""
echo "Uploading chunks to File Search Store..."
UPLOAD_COUNT=0
FAILED_COUNT=0

for csv_file in "${OUTPUT_DIR}"/indent_trips_part_*.csv; do
    if [ ! -f "$csv_file" ]; then
        continue
    fi
    
    FILENAME=$(basename "$csv_file")
    FILE_SIZE=$(wc -c < "$csv_file")
    echo ""
    echo "Uploading: ${FILENAME} (${FILE_SIZE} bytes)..."
    
    # Initiate resumable upload
    TMP_HEADER="${OUTPUT_DIR}/upload_header_${FILENAME}.tmp"
    INIT_RESPONSE=$(curl -s -D "${TMP_HEADER}" -X POST \
        "https://generativelanguage.googleapis.com/upload/v1beta/${STORE_NAME}:uploadToFileSearchStore?key=${GEMINI_API_KEY}" \
        -H "X-Goog-Upload-Protocol: resumable" \
        -H "X-Goog-Upload-Command: start" \
        -H "X-Goog-Upload-Header-Content-Length: ${FILE_SIZE}" \
        -H "X-Goog-Upload-Header-Content-Type: text/csv" \
        -H "Content-Type: application/json")
    
    # Extract upload URL
    UPLOAD_URL=$(grep -i "x-goog-upload-url: " "${TMP_HEADER}" | cut -d" " -f2 | tr -d "\r")
    rm "${TMP_HEADER}"
    
    if [ -z "$UPLOAD_URL" ]; then
        echo "  ❌ Failed to get upload URL for ${FILENAME}"
        echo "  Response: ${INIT_RESPONSE}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        continue
    fi
    
    # Upload file
    UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" \
        "${UPLOAD_URL}" \
        -H "Content-Length: ${FILE_SIZE}" \
        -H "X-Goog-Upload-Offset: 0" \
        -H "X-Goog-Upload-Command: upload, finalize" \
        --data-binary "@${csv_file}")
    
    HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✅ Uploaded successfully"
        UPLOAD_COUNT=$((UPLOAD_COUNT + 1))
    else
        echo "  ❌ Upload failed with code: ${HTTP_CODE}"
        echo "  Response: ${UPLOAD_RESPONSE}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

echo ""
echo "========================================="
echo "Upload Summary:"
echo "  ✅ Successful: ${UPLOAD_COUNT}"
echo "  ❌ Failed: ${FAILED_COUNT}"
echo "========================================="

# Cleanup
echo ""
echo "Cleaning up temporary files..."
rm -rf "${OUTPUT_DIR}"

echo "Done!"
