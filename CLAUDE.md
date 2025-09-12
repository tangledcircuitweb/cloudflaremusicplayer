# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Epic Scripture is a 24/7 Christian radio streaming application built on Cloudflare Workers. It streams Bible audio content (primarily Psalms) with automatic crossfading between tracks and audio processing for consistent volume levels.

## Commands

### Development
```bash
npm run dev        # Start local Wrangler development server (http://localhost:8787)
npm test          # Run tests in watch mode with Vitest
npm test:run      # Run tests once
npm run deploy    # Deploy to Cloudflare Workers
```

### Audio Management
```bash
./upload_psalms.sh       # Upload audio files to the platform
./optimize_psalms.sh     # Optimize audio files before upload
./replace_with_mp3s.sh   # Convert audio files to MP3 format
```

## Architecture

### Core Components

1. **Main Server (src/index.js)**
   - Single-file architecture containing both backend and frontend code
   - Cloudflare Worker that handles all HTTP routing
   - KV storage integration for audio files and metadata
   - Embedded HTML/CSS/JS for the web player interface

2. **Audio Streaming System**
   - Files stored in Cloudflare KV with keys like `audio/{filename}`
   - Metadata stored with key `audio-metadata`
   - Automatic playlist management with continuous playback
   - 3-second crossfade between tracks using Web Audio API

3. **Web Audio Processing Chain**
   - High-pass filter (200Hz) to reduce low-frequency content
   - Compressor for dynamic range control
   - Limiter to prevent clipping
   - Gain staging for consistent output levels

### Key Endpoints

- `GET /` - Main web player interface
- `GET /stream/{filename}` - Stream specific audio file
- `GET /list` - Get playlist of available audio files
- `GET /now-playing` - Current playing track information
- `POST /upload` - Upload new audio files (requires AUTH_TOKEN)
- `GET /favicon.ico` - Favicon asset
- `GET /chirho.png` - Social media sharing image

### Frontend Features

- Glassmorphism design with animated gradients
- Visual progress bar with smooth animations
- Play/Stop and Skip controls
- Real-time "Now Playing" display with Bible verse extraction
- Mobile-responsive design using Tailwind CSS
- SEO-optimized meta tags for social media sharing

## Testing

Tests use Vitest with JSDOM environment. The test file (src/index.test.js) covers:
- Basic request handling
- Audio streaming functionality
- Metadata management
- Authentication for uploads

## Deployment

The application deploys to Cloudflare Workers using Wrangler. Configuration in `wrangler.toml` includes:
- KV namespace binding (AUDIO_STORE)
- Environment variables (AUTH_TOKEN for upload authentication)

## Important Notes

- Audio files should be in MP3 format for optimal compatibility
- Filenames should follow pattern: `{book}_{chapter}_{verse}.mp3` for proper verse extraction
- The player automatically extracts Bible reference from filename for display
- All audio processing happens client-side using Web Audio API
- The application uses no external dependencies beyond Cloudflare Workers runtime