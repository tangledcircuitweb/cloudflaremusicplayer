#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

if [ -z "$EPIC_API_KEY" ]; then
    echo "Error: EPIC_API_KEY not found in .env file"
    exit 1
fi

UPLOAD_URL="https://radio-stream.njordrenterprises.workers.dev/upload"
MUSIC_DIR="/home/tangledcircuit/Music/epicscripture_optimized"

echo "Starting upload of Psalm files..."
echo "Found $(ls "$MUSIC_DIR"/*.mp3 | wc -l) WAV files"

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
        
        # Small delay to avoid overwhelming the server
        sleep 1
    fi
done

echo "Upload complete! Uploaded $count files to Epic Scripture radio."
