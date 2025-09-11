#!/bin/bash

# Load S3 credentials from .env
if [ -f .env ]; then
    export $(cat .env | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

# R2 S3-compatible endpoint
ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
BUCKET="radio-music"

echo "Listing all objects in bucket..."
aws s3 ls s3://$BUCKET/ --endpoint-url=$ENDPOINT

echo ""
echo "Deleting WAV files (keeping MP3s)..."

# List and delete WAV files
aws s3 ls s3://$BUCKET/ --endpoint-url=$ENDPOINT | grep "\.wav" | awk '{print $4}' | while read file; do
    echo "Deleting: $file"
    aws s3 rm s3://$BUCKET/"$file" --endpoint-url=$ENDPOINT
done

echo ""
echo "Remaining files:"
aws s3 ls s3://$BUCKET/ --endpoint-url=$ENDPOINT
