#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

echo "Clearing existing WAV files from bucket..."
npx wrangler r2 object list radio-music --json | jq -r '.[].key' | while read key; do
    if [[ $key != __* ]]; then
        echo "Deleting: $key"
        npx wrangler r2 object delete radio-music "$key"
    fi
done

echo ""
echo "Uploading optimized MP3 files..."

UPLOAD_URL="https://radio-stream.njordrenterprises.workers.dev/upload"
MUSIC_DIR="/home/tangledcircuit/Music/epicscripture_optimized"

count=0
total=$(ls "$MUSIC_DIR"/*.mp3 | wc -l)

for file in "$MUSIC_DIR"/*.mp3; do
    if [ -f "$file" ]; then
        count=$((count + 1))
        filename=$(basename "$file")
        echo "[$count/$total] Uploading: $filename"
        
        response=$(curl -s -H "Authorization: Bearer $EPIC_API_KEY" \
                       -F "audio=@$file" \
                       "$UPLOAD_URL")
        
        if [[ $response == *"Uploaded:"* ]]; then
            echo "✅ Success: $filename"
        else
            echo "❌ Failed: $filename - $response"
        fi
        
        sleep 0.5
    fi
done

echo ""
echo "Replacement complete! Epic Scripture now uses optimized MP3s."
