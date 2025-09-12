#!/bin/bash

# Upload remaining tracks to Cloudflare KV with timestamp indexing (skipping the first 5 already uploaded)

echo "Uploading remaining tracks to KV with timestamp indexing..."

# Create temporary Node.js script for processing
cat > process-mp3.js << 'EOF'
const fs = require('fs');
const path = require('path');

const filename = process.argv[2];
const filepath = process.argv[3];

const buffer = fs.readFileSync(filepath);
const duration = Math.floor((buffer.length * 8) / 128000); // Approximate 128kbps

const timestampIndex = {};
for (let second = 0; second <= duration; second++) {
  timestampIndex[second] = Math.floor((second / duration) * buffer.length);
}

const indexData = {
  metadata: {
    filename: path.basename(filename),
    size: buffer.length,
    duration,
    uploadedAt: new Date().toISOString(),
    contentType: 'audio/mpeg'
  },
  timestampIndex
};

// Save for wrangler upload
fs.writeFileSync(`${filename}.index.json`, JSON.stringify(indexData));
console.log(JSON.stringify(indexData.metadata));
EOF

# Files already uploaded
UPLOADED_FILES=(
  "Psalm 103_.mp3"
  "Psalm 10 .mp3"
  "Psalm 11.mp3"
  "Psalm 12.mp3"
  "Psalm 13.mp3"
)

# Track metadata for master index - start with existing tracks
echo "Fetching existing metadata..."
EXISTING_METADATA=$(npx wrangler kv key get "audio-metadata" --namespace-id 4b6f4a930c224912865d820f5ea4c1dc --remote)
TRACKS_JSON=$(echo "$EXISTING_METADATA" | jq '.tracks')

# Process remaining MP3 files
COUNT=5  # Start from 5 since we already have 5
TOTAL=$(ls src/epicscripture/*.mp3 2>/dev/null | wc -l)

for file in src/epicscripture/*.mp3; do
  FILENAME=$(basename "$file")
  
  # Skip if already uploaded
  if [[ " ${UPLOADED_FILES[@]} " =~ " ${FILENAME} " ]]; then
    echo "Skipping already uploaded: $FILENAME"
    continue
  fi
  
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] Processing: $FILENAME"
  
  # Generate index
  METADATA=$(node process-mp3.js "$FILENAME" "$file")
  
  # Upload audio file to KV (REMOTE)
  echo "  Uploading audio..."
  npx wrangler kv key put "audio:$FILENAME" --path "$file" --namespace-id 4b6f4a930c224912865d820f5ea4c1dc --remote
  
  # Upload index to KV (REMOTE)
  echo "  Uploading index..."
  npx wrangler kv key put "audio-index:$FILENAME" --path "$FILENAME.index.json" --namespace-id 4b6f4a930c224912865d820f5ea4c1dc --remote
  
  # Add to tracks array
  TRACKS_JSON=$(echo "$TRACKS_JSON" | jq ". += [$METADATA]")
  
  # Clean up temp file
  rm "$FILENAME.index.json"
  
  echo "  ✓ Complete"
  echo
done

# Update master metadata with all tracks
echo "Updating master metadata..."
MASTER_JSON=$(echo "{\"tracks\": $TRACKS_JSON, \"updatedAt\": \"$(date -Iseconds)\"}" | jq .)
echo "$MASTER_JSON" > audio-metadata.json
npx wrangler kv key put "audio-metadata" --path audio-metadata.json --namespace-id 4b6f4a930c224912865d820f5ea4c1dc --remote

# Clean up
rm process-mp3.js audio-metadata.json

echo "Upload complete! Total tracks in KV: $(echo "$TRACKS_JSON" | jq '. | length')"
echo
echo "All tracks are now available for streaming with seek support:"
echo "  /stream              - Random track"
echo "  /stream/{filename}   - Specific track"
echo "  /stream/{filename}?t=30  - Seek to 30 seconds"
echo "  /playlist            - Get all tracks"