# Deployment Guide for Epic Scripture Radio

## Prerequisites
- Node.js and npm installed
- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)

## Setup Instructions

### 1. Clone the Repository
```bash
git clone [repository-url]
cd radio
npm install
```

### 2. Configure Cloudflare KV Namespace
The application requires a KV namespace for storing audio files and metadata.

Create a new KV namespace:
```bash
npx wrangler kv namespace create "RADIO_KV"
```

Update `wrangler.toml` with your namespace ID:
```toml
[[kv_namespaces]]
binding = "RADIO_KV"
id = "YOUR_NAMESPACE_ID_HERE"
```

### 3. Set Required Secrets
The application uses one secret for upload authentication:

```bash
# Set the upload secret (use a strong, random string)
npx wrangler secret put UPLOAD_SECRET
```

When prompted, enter a secure token that will be used to authenticate upload requests.

### 4. Upload Audio Files
First, upload the Chi-Rho logo:
```bash
# Upload the Chi-Rho image asset
npx wrangler kv key put "assets:chirho.png" --path chirho.png --namespace-id YOUR_NAMESPACE_ID --remote
```

Then upload your audio files using the provided scripts:
```bash
# Upload audio files with timestamp indexing
./upload-5-tracks.sh  # For initial tracks
./upload-remaining-tracks.sh  # For additional tracks
```

### 5. Deploy to Cloudflare Workers
```bash
npm run deploy
```

## Environment Variables
The `.env` file contains `EPIC_API_KEY` which is currently not used in the application. If you plan to integrate with Epic Scripture API in the future, keep this secure.

## Secrets Summary
| Secret Name | Purpose | Where to Set |
|------------|---------|--------------|
| `UPLOAD_SECRET` | Authenticates file upload requests | Cloudflare Workers (via `wrangler secret put`) |

## KV Storage Structure
- `audio:{filename}` - Audio file data
- `audio-index:{filename}` - Timestamp index for seeking
- `audio-metadata` - Master playlist metadata
- `global_minutes_served` - Total listening time counter
- `__current_song` - Currently playing track
- `assets:chirho.png` - Chi-Rho logo image

## Important Notes
- The KV namespace binding name must be `RADIO_KV`
- Audio files should be in MP3 format
- The application requires a paid Cloudflare KV plan for unlimited requests
- All secrets are managed through Cloudflare Workers, not in the repository

## Testing Locally
```bash
npm run dev
```
Access the application at `http://localhost:8787`

## Production URL
After deployment, your application will be available at:
`https://[your-worker-name].workers.dev`

Or on your custom domain if configured in Cloudflare.