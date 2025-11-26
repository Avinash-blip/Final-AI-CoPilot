#!/bin/bash
set -e

source .env

FILE_PATH="/Users/admin/Downloads/trips_closed_data.xlsx"
FILENAME="trips_closed_data.xlsx"
MIME_TYPE="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
STORE_NAME="fileSearchStores/${FILE_SEARCH_STORE_NAME}"

FILE_SIZE=$(wc -c < "${FILE_PATH}")
echo "Uploading: ${FILENAME} (${FILE_SIZE} bytes)..."

# Initiate resumable upload
TMP_HEADER="/tmp/upload_header.tmp"
curl -s -D "${TMP_HEADER}" -X POST \
  "https://generativelanguage.googleapis.com/upload/v1beta/${STORE_NAME}:uploadToFileSearchStore?key=${GEMINI_API_KEY}" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${FILE_SIZE}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json"

# Extract upload URL
UPLOAD_URL=$(grep -i "x-goog-upload-url: " "${TMP_HEADER}" | cut -d" " -f2 | tr -d "\r")
rm "${TMP_HEADER}"

if [ -z "$UPLOAD_URL" ]; then
  echo "❌ Failed to get upload URL"
  exit 1
fi

echo "Upload URL obtained. Uploading file..."

# Upload file
curl -v "${UPLOAD_URL}" \
  -H "Content-Length: ${FILE_SIZE}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${FILE_PATH}"

echo ""
echo "✅ Upload complete!"
