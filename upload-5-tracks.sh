#!/bin/bash

# Upload first 5 MP3 tracks to Cloudflare KV with timestamp indexing

echo "Uploading first 5 tracks to KV with timestamp indexing..."

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

# Track metadata for master index
TRACKS_JSON="[]"

# Process first 5 MP3 files
COUNT=0
for file in src/epicscripture/*.mp3; do
  if [ $COUNT -ge 5 ]; then
    break
  fi
  
  FILENAME=$(basename "$file")
  echo "Processing: $FILENAME"
  
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
  
  COUNT=$((COUNT + 1))
  echo "  ✓ Complete"
  echo
done

# Create and upload master metadata
echo "Creating master metadata..."
MASTER_JSON=$(echo "{\"tracks\": $TRACKS_JSON, \"updatedAt\": \"$(date -Iseconds)\"}" | jq .)
echo "$MASTER_JSON" > audio-metadata.json
npx wrangler kv key put "audio-metadata" --path audio-metadata.json --namespace-id 4b6f4a930c224912865d820f5ea4c1dc --remote

# Clean up
rm process-mp3.js audio-metadata.json

echo "Upload complete! $COUNT tracks uploaded with timestamp indexing."
echo
echo "Tracks are now available for streaming with seek support:"
echo "  /stream/{filename}       - Stream full file"
echo "  /stream/{filename}?t=30  - Seek to 30 seconds"
echo "  /playlist                - Get all tracks"