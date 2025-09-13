# 🔥 Epic Scripture Radio

A 24/7 Christian radio streaming application featuring the Book of Psalms with an immersive fire visualization that dances to the Word of God.

![Epic Scripture Radio](chirho.png)

## ✨ Features

### 🎵 Audio Streaming
- **24/7 Continuous Playback** - Streams 64 Psalms in random order
- **Seamless Crossfading** - 1-second smooth transitions between tracks
- **Smart Audio Processing** - Compressor and limiter for consistent volume
- **Seek Support** - Jump to any position in the current track
- **Track History** - Navigate backward through previously played tracks

### 🎨 Fire Visualization
- **128 Frequency Bands** - Real-time audio spectrum analysis
- **5 Rotating Circles** - Concentric layers with alternating rotation
- **Fire Color Gradients** - 8 intensity levels from white-hot to ember
- **Chi-Rho Symbol** - Protected center with golden glow
- **640 Total Fire Bars** - Hypnotic patterns responding to scripture audio

### 📊 Global Listening Counter
- **Real-time Tracking** - Counts total listening time across all users
- **Smart Display** - Shows as "X hours : Y minutes" or days for longer periods
- **Persistent Storage** - Maintained in Cloudflare KV

### 🎮 Player Controls
- **Play/Stop** - Large centered control with visual feedback
- **Skip Forward** - Jump to a new random track
- **Skip Backward** - Return to previous track with full metadata
- **Visual Progress Bar** - Animated timeline showing track position
- **Now Playing Display** - Extracts and displays Bible verse from filename

### 📱 Responsive Design
- **Mobile Optimized** - Works perfectly on all devices
- **Glassmorphism UI** - Modern frosted glass effects
- **Animated Gradients** - Subtle background animations
- **SEO Optimized** - Full meta tags for social sharing

## 🚀 Technology Stack

- **Runtime**: Cloudflare Workers (Edge Computing)
- **Storage**: Cloudflare KV (Key-Value Store)
- **Frontend**: Vanilla JavaScript with Web Audio API
- **Styling**: Tailwind CSS (inline)
- **Audio**: MP3 format with timestamp indexing
- **Visualization**: Canvas 2D API with real-time FFT analysis

## 📦 Installation

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup instructions.

### Quick Start

1. **Clone the repository**
```bash
git clone [repository-url]
cd radio
npm install
```

2. **Configure Cloudflare KV**
```bash
npx wrangler kv namespace create "RADIO_KV"
```

3. **Set secrets**
```bash
npx wrangler secret put UPLOAD_SECRET
```

4. **Deploy**
```bash
npm run deploy
```

## 🎯 Usage

### Local Development
```bash
npm run dev
# Visit http://localhost:8787
```

### Production Deployment
```bash
npm run deploy
# Your app will be available at https://[your-worker].workers.dev
```

### Running Tests
```bash
npm test        # Watch mode
npm run test:run # Single run
```

## 📁 Project Structure

```
radio/
├── src/
│   ├── index.js           # Main application (Worker + Frontend)
│   ├── index.test.js      # Test suite
│   └── epicscripture/     # Audio files (64 Psalms)
├── wrangler.toml          # Cloudflare Workers configuration
├── CLAUDE.md              # AI assistant instructions
├── DEPLOYMENT.md          # Deployment guide
├── chirho.png             # Chi-Rho logo
└── upload scripts         # Audio upload utilities
```

## 🔑 API Endpoints

- `GET /` - Main player interface
- `GET /stream/{filename}` - Stream specific audio file
- `GET /stream?t={seconds}` - Stream with seek position
- `GET /playlist` - Get all available tracks
- `GET /now-playing` - Current track information
- `GET /api/minutes` - Get total listening time
- `POST /api/minutes?minutes=1` - Increment listening counter
- `POST /upload` - Upload new audio (requires auth)

## 🎨 Visualizer Details

The fire visualizer creates a mesmerizing display with:
- **Frequency Response**: Each bar represents a specific frequency
- **Dynamic Scaling**: Bars grow/shrink based on audio amplitude
- **Color Intensity**: 8 fire gradients from blazing white to dim embers
- **Rotation Effects**: 5 circles rotating at different speeds
- **Alternating Direction**: Creates hypnotic spiral patterns

## 🔐 Security

- Upload endpoint protected with Bearer token authentication
- Secrets managed through Cloudflare Workers
- No sensitive data in repository
- `.env` file excluded from version control

## 📈 Performance

- **Edge Computing**: Runs on Cloudflare's global network
- **Low Latency**: Audio streamed directly from KV storage
- **Client-side Processing**: Visualization runs in browser
- **Efficient Caching**: Static assets cached for 1 year
- **Minimal Server Load**: All heavy processing on client

## 🙏 Credits

- **Audio Content**: Epic Scripture audio narrations of Psalms
- **Visualization**: Inspired by the fire of the Holy Spirit
- **Symbol**: Chi-Rho (☧) - Ancient Christian symbol

## 📄 License

This project is for the glory of God and the edification of His people.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- Tests pass (`npm test`)
- No sensitive data in commits
- Comments are minimal and meaningful

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

*"Your word is a lamp to my feet and a light to my path." - Psalm 119:105*