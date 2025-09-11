#!/bin/bash

# Load R2 credentials from .env
if [ -f .env ]; then
    export $(cat .env | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

echo "Using Cloudflare R2 API to clean bucket..."

# Use wrangler to list and delete objects
echo "Listing current objects..."
npx wrangler r2 bucket info radio-music

echo ""
echo "This will delete WAV files and keep MP3s."
echo "You'll need to delete the WAV files manually via Cloudflare Dashboard:"
echo "1. Go to https://dash.cloudflare.com"
echo "2. Navigate to R2 Object Storage"
echo "3. Click on 'radio-music' bucket"
echo "4. Select and delete the WAV files (keep the MP3s)"
echo ""
echo "Or provide your R2 Token and Key ID for automated deletion."
