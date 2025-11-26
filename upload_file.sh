#!/bin/bash
source .env

FILE_PATH="/Users/admin/Downloads/indent_trips_epod_data.csv"
MIME_TYPE="text/csv"
NUM_BYTES=$(wc -c < "${FILE_PATH}")
STORE_NAME="fileSearchStores/${FILE_SEARCH_STORE_NAME}"

echo "Uploading ${FILE_PATH} to ${STORE_NAME}..."

# Initiate Resumable Upload
TMP_HEADER="upload-header.tmp"
curl -s -D "${TMP_HEADER}" -X POST \
  "https://generativelanguage.googleapis.com/upload/v1beta/${STORE_NAME}:uploadToFileSearchStore?key=${GEMINI_API_KEY}" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" \


cat "${TMP_HEADER}"

# Extract upload_url
UPLOAD_URL=$(grep -i "x-goog-upload-url: " "${TMP_HEADER}" | cut -d" " -f2 | tr -d "\r")
rm "${TMP_HEADER}"

if [ -z "$UPLOAD_URL" ]; then
  echo "Failed to get upload URL"
  exit 1
fi

echo "Upload URL obtained. Uploading bytes..."

# Upload bytes
curl "${UPLOAD_URL}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${FILE_PATH}"

echo "Upload complete."
