#!/bin/bash
set -e

source .env

STORE_NAME="fileSearchStores/${FILE_SEARCH_STORE_NAME}"
DATA_DIR="data"

upload_file() {
  local FILE_PATH="$1"
  local DISPLAY_NAME="$2"
  local MIME_TYPE="$3"
  
  FILE_SIZE=$(wc -c < "${FILE_PATH}")
  echo "📤 Uploading: ${DISPLAY_NAME} (${FILE_SIZE} bytes)..."
  
  TMP_HEADER="/tmp/upload_header_$(basename ${FILE_PATH}).tmp"
  curl -s -D "${TMP_HEADER}" -X POST \
    "https://generativelanguage.googleapis.com/upload/v1beta/${STORE_NAME}:uploadToFileSearchStore?key=${GEMINI_API_KEY}" \
    -H "X-Goog-Upload-Protocol: resumable" \
    -H "X-Goog-Upload-Command: start" \
    -H "X-Goog-Upload-Header-Content-Length: ${FILE_SIZE}" \
    -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
    -H "Content-Type: application/json" > /dev/null
  
  UPLOAD_URL=$(grep -i "x-goog-upload-url: " "${TMP_HEADER}" | cut -d" " -f2 | tr -d "\r")
  rm "${TMP_HEADER}"
  
  if [ -z "$UPLOAD_URL" ]; then
    echo "  ❌ Failed to get upload URL"
    return 1
  fi
  
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null \
    "${UPLOAD_URL}" \
    -H "Content-Length: ${FILE_SIZE}" \
    -H "X-Goog-Upload-Offset: 0" \
    -H "X-Goog-Upload-Command: upload, finalize" \
    --data-binary "@${FILE_PATH}")
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ Success"
  else
    echo "  ❌ Failed: HTTP $HTTP_CODE"
    return 1
  fi
}

echo "🚀 Uploading optimized files to File Search Store..."
echo ""

# Upload schema
upload_file "${DATA_DIR}/schema.md" "Data Schema" "text/markdown"

# Upload summary
upload_file "${DATA_DIR}/optimized/indent_trips_epod_data_summary.md" "Trip Summary Statistics" "text/markdown"

# Upload samples
upload_file "${DATA_DIR}/optimized/indent_trips_epod_data_normal_trips.md" "Normal Trips Sample" "text/markdown"
upload_file "${DATA_DIR}/optimized/indent_trips_epod_data_delayed_trips.md" "Delayed Trips Sample" "text/markdown"
upload_file "${DATA_DIR}/optimized/indent_trips_epod_data_exception_cases.md" "Exception Cases Sample" "text/markdown"

echo ""
echo "✅ Upload complete!"
echo "📊 Total uploaded: ~2MB of optimized data"
