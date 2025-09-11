#!/bin/bash

echo "Setting up 24/7 Radio Stream..."

# Install dependencies
npm install

# Create R2 bucket for music storage
wrangler r2 bucket create radio-music

echo "Setup complete!"
echo "1. Run 'npm run dev' to start development server"
echo "2. Upload songs via /upload endpoint"
echo "3. Stream at /stream endpoint"
echo "4. Deploy with 'npm run deploy'"
