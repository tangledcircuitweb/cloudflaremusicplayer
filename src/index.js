async function handleStaticAsset(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Handle different image requests - serve chirho.png from R2 bucket
  if (path === '/og-image.jpg' || path === '/twitter-image.jpg' || 
      path === '/apple-touch-icon.png' || path === '/favicon-32x32.png' || 
      path === '/favicon-16x16.png' || path === '/favicon.ico') {
    
    try {
      const imageObject = await env.MUSIC_BUCKET.get('chirho.png');
      if (!imageObject) {
        return new Response('Image not found', { status: 404 });
      }
      
      // Determine content type based on request
      let contentType = 'image/png';
      if (path.includes('.jpg')) {
        contentType = 'image/jpeg';
      } else if (path.includes('.ico')) {
        contentType = 'image/x-icon';
      }
      
      return new Response(imageObject.body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Error serving image:', error);
      return new Response('Error serving image', { status: 500 });
    }
  }
  
  return null; // Not a static asset
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle static assets FIRST before other routes
    if (url.pathname === '/og-image.jpg' || url.pathname === '/twitter-image.jpg' || 
        url.pathname === '/apple-touch-icon.png' || url.pathname === '/favicon-32x32.png' || 
        url.pathname === '/favicon-16x16.png' || url.pathname === '/favicon.ico') {
      
      try {
        const imageData = await env.RADIO_KV.get('chirho.png', 'arrayBuffer');
        if (!imageData) {
          return new Response('Image not found', { status: 404 });
        }
        
        let contentType = 'image/png';
        if (url.pathname.includes('.jpg')) {
          contentType = 'image/jpeg';
        } else if (url.pathname.includes('.ico')) {
          contentType = 'image/x-icon';
        }
        
        return new Response(imageData, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        console.error('Error serving image:', error);
        return new Response('Error serving image', { status: 500 });
      }
    }
    
    // Handle streaming with optional seeking
    if (url.pathname.startsWith('/stream')) {
      return handleStreamWithSeek(request, env);
    }
    
    // Handle playlist endpoint
    if (url.pathname === '/playlist') {
      return handlePlaylist(env);
    }
    
    if (url.pathname === '/now-playing') {
      return handleNowPlaying(env);
    }
    
    if (url.pathname === '/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }
    
    return new Response(getPlayerHTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};


async function handleNowPlaying(env) {
  try {
    const currentSong = await env.RADIO_KV.get('__current_song');
    if (!currentSong) {
      return new Response(JSON.stringify({ 
        song: 'No song playing',
        verse: '',
        book: 'Scripture'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    const verseInfo = extractVerseInfo(currentSong);
    
    return new Response(JSON.stringify({
      song: verseInfo.title,
      verse: verseInfo.verse,
      book: verseInfo.book
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in handleNowPlaying:', error);
    return new Response(JSON.stringify({ 
      song: 'Error loading',
      verse: '',
      book: 'Scripture'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 500
    });
  }
}

function extractVerseInfo(filename) {
  const cleaned = filename.replace(/^\d+-/, '').replace(/\.[^.]+$/, '');
  
  const bibleBooks = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', 'Samuel', 'Kings', 'Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 'Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', 'Thessalonians', 'Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', 'Peter', 'Jude', 'Revelation'];
  
  for (const book of bibleBooks) {
    if (cleaned.toLowerCase().includes(book.toLowerCase())) {
      const verseMatch = cleaned.match(/(\d+):?(\d+)?/);
      return {
        title: cleaned,
        book: book,
        verse: verseMatch ? `${verseMatch[1]}${verseMatch[2] ? ':' + verseMatch[2] : ''}` : ''
      };
    }
  }
  
  return {
    title: cleaned,
    book: 'Scripture',
    verse: ''
  };
}

async function handleUpload(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.UPLOAD_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const formData = await request.formData();
  const file = formData.get('audio');
  
  if (!file) {
    return new Response('No file provided', { status: 400 });
  }
  
  const filename = file.name;
  const arrayBuffer = await file.arrayBuffer();
  await env.RADIO_KV.put(`audio:${filename}`, arrayBuffer);
  
  // Update metadata
  const metadata = await env.RADIO_KV.get('audio-metadata', 'json') || { tracks: [] };
  if (!metadata.tracks.find(t => t.filename === filename)) {
    metadata.tracks.push({ 
      filename, 
      size: arrayBuffer.byteLength,
      uploadedAt: new Date().toISOString() 
    });
    await env.RADIO_KV.put('audio-metadata', JSON.stringify(metadata));
  }
  
  return new Response(`Uploaded: ${filename}`);
}

async function getPlaylist(env) {
  try {
    const metadata = await env.RADIO_KV.get('audio-metadata', 'json');
    if (metadata && metadata.tracks) {
      return metadata.tracks.map(t => t.filename);
    }
    return [];
  } catch (error) {
    console.error('Error getting playlist:', error);
    return [];
  }
}

async function handleStreamWithSeek(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(p => p); // Remove empty parts
  
  let filename = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;
  
  // Handle /stream or /stream?timestamp (no filename)
  if (!filename || filename === 'stream') {
    // No specific file, play random
    const metadata = await env.RADIO_KV.get('audio-metadata', 'json');
    if (!metadata || !metadata.tracks || metadata.tracks.length === 0) {
      return new Response('No songs available', { status: 404 });
    }
    const randomTrack = metadata.tracks[Math.floor(Math.random() * metadata.tracks.length)];
    filename = randomTrack.filename;
    // Don't recursively call, just continue with the selected filename
  }
  
  const seekTime = url.searchParams.get('t'); // Time in seconds
  
  // Get the full audio file from KV
  const audioData = await env.RADIO_KV.get(`audio:${filename}`, 'arrayBuffer');
  if (!audioData) {
    return new Response('Audio not found', { status: 404 });
  }
  
  // Update current song
  await env.RADIO_KV.put('__current_song', filename);
  
  // Handle range requests for scrubbing
  const range = request.headers.get('range');
  
  if (range || seekTime !== null) {
    // Get timestamp index for this file
    const indexData = await env.RADIO_KV.get(`audio-index:${filename}`, 'json');
    
    let start = 0;
    let end = audioData.byteLength - 1;
    
    if (seekTime !== null && indexData) {
      // Use timestamp index to find byte position
      const second = Math.floor(parseFloat(seekTime));
      const bytePosition = indexData.timestampIndex[second];
      if (bytePosition !== undefined) {
        start = bytePosition;
      }
    } else if (range) {
      // Parse standard range header
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : audioData.byteLength - 1;
    }
    
    const chunkSize = end - start + 1;
    const chunk = audioData.slice(start, end + 1);
    
    return new Response(chunk, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${audioData.byteLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  // Return full file if no seeking
  return new Response(audioData, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioData.byteLength.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handlePlaylist(env) {
  const metadata = await env.RADIO_KV.get('audio-metadata', 'json');
  if (!metadata) {
    return new Response(JSON.stringify({ tracks: [] }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  return new Response(JSON.stringify(metadata), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}


function getPlayerHTML() {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Epic Scripture - Holy Bible Music Radio</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta charset="UTF-8">
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="Experience the beauty of Scripture through continuous audio streaming of the Psalms. Peaceful, meditative, and spiritually enriching.">
    <meta name="keywords" content="Bible, Psalms, Scripture, Audio, Christian, Music, Radio, Streaming, Meditation, Prayer">
    <meta name="author" content="Epic Scripture">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://epicscripture.com">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="Epic Scripture - Psalms Audio Stream">
    <meta property="og:description" content="Experience the beauty of Scripture through continuous audio streaming of the Psalms. Peaceful, meditative, and spiritually enriching.">
    <meta property="og:image" content="https://epicscripture.com/og-image.jpg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="https://epicscripture.com">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Epic Scripture">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Epic Scripture - Psalms Audio Stream">
    <meta name="twitter:description" content="Experience the beauty of Scripture through continuous audio streaming of the Psalms. Peaceful, meditative, and spiritually enriching.">
    <meta name="twitter:image" content="https://epicscripture.com/twitter-image.jpg">
    
    <!-- Apple Meta Tags -->
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Epic Scripture">
    <link rel="apple-touch-icon" href="https://epicscripture.com/apple-touch-icon.png">
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="https://epicscripture.com/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="https://epicscripture.com/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="https://epicscripture.com/favicon-16x16.png">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        'serif': ['Cinzel', 'serif'],
                        'sans': ['Inter', 'system-ui', 'sans-serif'],
                    },
                    backdropBlur: {
                        'xs': '2px',
                        'xl': '24px',
                        '2xl': '40px',
                        '3xl': '64px',
                    }
                }
            }
        }
    </script>
    <style>
        .glass-intense {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(40px) saturate(180%);
            -webkit-backdrop-filter: blur(40px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.2),
                inset 0 -1px 0 rgba(255, 255, 255, 0.1);
        }
        .glass-card {
            background: linear-gradient(135deg, 
                rgba(255, 255, 255, 0.1) 0%,
                rgba(255, 255, 255, 0.05) 50%,
                rgba(255, 255, 255, 0.02) 100%);
            backdrop-filter: blur(60px) saturate(200%) brightness(110%);
            -webkit-backdrop-filter: blur(60px) saturate(200%) brightness(110%);
            border: 2px solid rgba(255, 255, 255, 0.3);
            box-shadow: 
                0 20px 60px rgba(0, 0, 0, 0.15),
                0 8px 25px rgba(0, 0, 0, 0.1),
                inset 0 2px 4px rgba(255, 255, 255, 0.4),
                inset 0 -2px 4px rgba(255, 255, 255, 0.2);
        }
        .glass-button {
            background: linear-gradient(135deg, 
                rgba(255, 255, 255, 0.2) 0%,
                rgba(255, 255, 255, 0.1) 100%);
            backdrop-filter: blur(20px) saturate(150%);
            -webkit-backdrop-filter: blur(20px) saturate(150%);
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 
                0 4px 15px rgba(0, 0, 0, 0.1),
                inset 0 1px 2px rgba(255, 255, 255, 0.3);
        }
        .mirror-effect {
            background: linear-gradient(135deg, 
                rgba(255, 255, 255, 0.15) 0%,
                rgba(255, 255, 255, 0.08) 25%,
                rgba(255, 255, 255, 0.03) 50%,
                rgba(255, 255, 255, 0.08) 75%,
                rgba(255, 255, 255, 0.15) 100%);
            backdrop-filter: blur(30px) saturate(180%) contrast(120%);
            -webkit-backdrop-filter: blur(30px) saturate(180%) contrast(120%);
        }
        body {
            background: linear-gradient(135deg, 
                #f8fafc 0%, 
                #e2e8f0 25%, 
                #cbd5e1 50%, 
                #e2e8f0 75%, 
                #f8fafc 100%);
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
        }
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
    </style>
</head>
<body class="min-h-screen font-sans">
    <div class="min-h-screen flex flex-col items-center justify-center p-4 max-w-lg mx-auto pb-16 py-8">
        <div class="text-center mb-4 md:mb-6">
            <h1 class="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-transparent bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-700 bg-clip-text mb-2 md:mb-4 drop-shadow-lg filter brightness-110 whitespace-nowrap">
                Epic Scripture
            </h1>
            <div class="flex items-center justify-center space-x-2 text-gray-700 text-sm">
                <i data-lucide="radio" class="w-4 h-4 text-amber-600 drop-shadow-sm"></i>
                <span class="font-medium drop-shadow-sm">Streaming The Lord 24 Hours a Day</span>
            </div>
        </div>

        <div class="w-full glass-card rounded-3xl overflow-hidden">
            <div class="p-6 text-center mirror-effect">
                <div class="flex justify-center items-center space-x-4 mb-3">
                    <button id="prevBtn" class="w-12 h-12 rounded-full glass-button hover:bg-white/20 transition-all duration-300 flex items-center justify-center transform hover:scale-105">
                        <i data-lucide="skip-back" class="w-5 h-5 text-gray-700 drop-shadow-sm"></i>
                    </button>
                    
                    <button id="playBtn" class="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105 border-2 border-white/40 glass-button">
                        <i id="playIcon" data-lucide="play" class="w-6 h-6 text-white ml-1 drop-shadow-lg"></i>
                        <i id="stopIcon" data-lucide="square" class="w-6 h-6 text-white hidden drop-shadow-lg"></i>
                    </button>
                    
                    <button id="nextBtn" class="w-12 h-12 rounded-full glass-button hover:bg-white/20 transition-all duration-300 flex items-center justify-center transform hover:scale-105">
                        <i data-lucide="skip-forward" class="w-5 h-5 text-gray-700 drop-shadow-sm"></i>
                    </button>
                </div>
                
                <!-- Timeline Scrubber -->
                <div class="mb-3 px-4">
                    <div class="flex items-center space-x-2 text-xs text-gray-600">
                        <span id="currentTime">0:00</span>
                        <div class="flex-1 relative">
                            <div class="w-full h-2 bg-white/30 rounded-lg glass-button relative overflow-hidden">
                                <div id="progressBar" class="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>
                        <span id="duration">0:00</span>
                    </div>
                </div>
                
                <p id="status" class="text-gray-700 text-sm font-medium drop-shadow-sm">Press play to Hear the Word of God</p>
            </div>

            <div class="glass-intense p-4 border-t border-white/30">
                <div class="text-center">
                    <div class="flex justify-center mb-2">
                        <i data-lucide="music" class="w-4 h-4 text-amber-600 drop-shadow-sm"></i>
                    </div>
                    <p class="text-gray-600 text-xs uppercase tracking-widest mb-2 font-serif drop-shadow-sm">Now Playing</p>
                    <h3 id="songTitle" class="text-gray-800 font-semibold text-base mb-1 font-serif drop-shadow-sm">Ready to Stream</h3>
                    <div class="flex items-center justify-center space-x-2">
                        <i data-lucide="book-open" class="w-3 h-3 text-amber-600 drop-shadow-sm"></i>
                        <p id="verseInfo" class="text-amber-700 text-xs font-medium drop-shadow-sm">Scripture Music</p>
                    </div>
                </div>
            </div>

            <div class="p-3 mirror-effect border-t border-white/20">
                <div class="flex justify-center space-x-6 text-gray-600 text-xs">
                    <div class="flex items-center space-x-1">
                        <i data-lucide="heart" class="w-3 h-3 text-red-400 drop-shadow-sm"></i>
                        <span class="font-medium drop-shadow-sm">BLESSED</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <i data-lucide="radio" class="w-3 h-3 text-green-500 drop-shadow-sm"></i>
                        <span class="font-medium drop-shadow-sm">STREAMING</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <i data-lucide="clock" class="w-3 h-3 text-blue-400 drop-shadow-sm"></i>
                        <span class="font-medium drop-shadow-sm">24/7</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-3 md:mt-4 text-center text-gray-600 text-xs glass-intense rounded-xl p-3">
            <p class="italic font-serif drop-shadow-sm">"Sing to the Lord a new song"</p>
            <p class="text-gray-500 mt-1 drop-shadow-sm">- Psalm 96:1</p>
        </div>
    </div>

    <script>
        lucide.createIcons();

        const playBtn = document.getElementById('playBtn');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const timeline = document.getElementById('progressBar');
        const currentTimeEl = document.getElementById('currentTime');
        const durationEl = document.getElementById('duration');
        const playIcon = document.getElementById('playIcon');
        const stopIcon = document.getElementById('stopIcon');
        const status = document.getElementById('status');
        const songTitle = document.getElementById('songTitle');
        const verseInfo = document.getElementById('verseInfo');
        
        let audioContext;
        let currentAudio = null;
        let nextAudio = null;
        let currentGain = null;
        let nextGain = null;
        let isPlaying = false;
        let nowPlayingInterval;
        let timeUpdateInterval;
        let crossfadeTimeout = null;
        let isTransitioning = false; // Prevent multiple crossfades

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }

        let isScrubbing = false;

        function updateTimeline() {
            if (currentAudio && !isNaN(currentAudio.duration)) {
                const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
                timeline.style.width = progress + '%';
                currentTimeEl.textContent = formatTime(currentAudio.currentTime);
                durationEl.textContent = formatTime(currentAudio.duration);
            }
        }

        function startTimeUpdates() {
            timeUpdateInterval = setInterval(updateTimeline, 1000);
        }

        function stopTimeUpdates() {
            if (timeUpdateInterval) {
                clearInterval(timeUpdateInterval);
                timeUpdateInterval = null;
            }
        }

        // Progress bar is visual only - no interaction

        // Initialize Web Audio Context
        function initAudioContext() {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            return audioContext;
        }

        function createAudioElement() {
            const audio = new Audio();
            audio.crossOrigin = "anonymous";
            return audio;
        }

        function connectAudioToContext(audio) {
            const source = audioContext.createMediaElementSource(audio);
            const gainNode = audioContext.createGain();
            
            // Create gentle compressor for volume leveling
            const compressor = audioContext.createDynamicsCompressor();
            
            // Gentle compression settings (preserve quality)
            compressor.threshold.setValueAtTime(-24, audioContext.currentTime); // Higher threshold = less compression
            compressor.knee.setValueAtTime(12, audioContext.currentTime);      // Softer knee for smoother compression
            compressor.ratio.setValueAtTime(2.5, audioContext.currentTime);    // Gentler 2.5:1 ratio
            compressor.attack.setValueAtTime(0.01, audioContext.currentTime);  // Slower 10ms attack
            compressor.release.setValueAtTime(0.25, audioContext.currentTime); // Longer 250ms release
            
            // Gentle limiter (safety only)
            const limiter = audioContext.createDynamicsCompressor();
            limiter.threshold.setValueAtTime(-3, audioContext.currentTime);    // Higher threshold
            limiter.knee.setValueAtTime(2, audioContext.currentTime);          // Soft knee
            limiter.ratio.setValueAtTime(8, audioContext.currentTime);         // Gentler 8:1 ratio
            limiter.attack.setValueAtTime(0.005, audioContext.currentTime);    // 5ms attack
            limiter.release.setValueAtTime(0.05, audioContext.currentTime);    // 50ms release
            
            // Reduced makeup gain
            const makeupGain = audioContext.createGain();
            makeupGain.gain.setValueAtTime(1.5, audioContext.currentTime);     // +3.5dB makeup gain (reduced)
            
            // Audio chain: Source → Compressor → Makeup Gain → Limiter → Volume → Output
            source.connect(compressor);
            compressor.connect(makeupGain);
            makeupGain.connect(limiter);
            limiter.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            console.log('Audio chain: Gentle compression and limiting applied');
            
            return { source, gainNode, compressor, limiter, makeupGain };
        }

        function crossfade(fromGain, toGain, duration = 3000) {
            const steps = 60; // 60 steps for smooth fade
            const stepTime = duration / steps;
            let step = 0;

            const fadeInterval = setInterval(() => {
                step++;
                const progress = step / steps;
                
                // Fade out current song
                if (fromGain) {
                    fromGain.gain.value = Math.max(0, 1 - progress);
                }
                
                // Fade in next song
                if (toGain) {
                    toGain.gain.value = Math.min(1, progress);
                }

                if (step >= steps) {
                    clearInterval(fadeInterval);
                    if (fromGain) fromGain.gain.value = 0;
                    if (toGain) toGain.gain.value = 1;
                }
            }, stepTime);
        }

        function updateNowPlaying() {
            fetch('/now-playing')
                .then(response => response.json())
                .then(data => {
                    songTitle.textContent = data.song || 'Holy Scripture Music';
                    verseInfo.textContent = data.book && data.verse ? 
                        \`\${data.book} \${data.verse}\` : 
                        (data.book || 'Sacred Verse');
                })
                .catch(() => {
                    songTitle.textContent = 'Holy Scripture Music';
                    verseInfo.textContent = 'Sacred Verse';
                });
        }

        function playNewSong(crossfadeEnabled = true) {
            // Prevent multiple simultaneous transitions
            if (isTransitioning) {
                console.log('Transition already in progress, ignoring...');
                return;
            }
            
            isTransitioning = true;
            console.log('Starting new song transition...');
            
            initAudioContext();
            
            // Create new audio element
            nextAudio = createAudioElement();
            nextAudio.src = '/stream?' + Date.now();
            
            const { gainNode, compressor, limiter, makeupGain } = connectAudioToContext(nextAudio);
            nextGain = gainNode;
            
            console.log('Audio processing chain created with compression and limiting');
            
            // Set up event listeners for this audio element
            setupAudioListeners(nextAudio);
            
            // Start with volume at 0 for crossfade
            if (crossfadeEnabled && currentAudio) {
                nextGain.gain.value = 0;
            } else {
                nextGain.gain.value = 1;
            }
            
            nextAudio.addEventListener('canplay', () => {
                if (isPlaying && nextAudio) {
                    nextAudio.play().then(() => {
                        if (crossfadeEnabled && currentAudio && currentGain && nextGain) {
                            console.log('Starting crossfade: old fading out, new fading in');
                            
                            // Store old audio reference
                            const oldAudio = currentAudio;
                            const oldGain = currentGain;
                            
                            // Start crossfade: both tracks playing, volumes crossfading
                            crossfade(oldGain, nextGain, 3000);
                            
                            // Switch references after starting crossfade
                            currentAudio = nextAudio;
                            currentGain = nextGain;
                            nextAudio = null;
                            nextGain = null;
                            
                            // Let old audio fade out naturally - browser will handle cleanup
                        } else {
                            // No crossfade - immediate switch
                            if (currentAudio) {
                                currentAudio.pause();
                                currentAudio.src = '';
                            }
                            currentAudio = nextAudio;
                            currentGain = nextGain;
                            nextAudio = null;
                            nextGain = null;
                        }
                        
                        setTimeout(() => {
                            isTransitioning = false;
                            console.log('Transition complete');
                        }, 500);
                        
                        updateNowPlaying();
                    }).catch((error) => {
                        console.error('Audio play error:', error);
                        status.textContent = 'Error loading stream';
                        isTransitioning = false;
                    });
                }
            });
            
            nextAudio.load();
        }

        function setPlayingState() {
            playBtn.className = 'w-16 h-16 rounded-full bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105 border-2 border-white/40 glass-button';
            playIcon.classList.add('hidden');
            stopIcon.classList.remove('hidden');
            status.textContent = 'Streaming The Word of God';
            isPlaying = true;
            startTimeUpdates();
        }

        function setStoppedState() {
            playBtn.className = 'w-16 h-16 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105 border-2 border-white/40 glass-button';
            playIcon.classList.remove('hidden');
            stopIcon.classList.add('hidden');
            status.textContent = 'Press play to Hear The Word of God';
            isPlaying = false;
            stopTimeUpdates();
            timeline.style.width = '0%';
            currentTimeEl.textContent = '0:00';
            durationEl.textContent = '0:00';
        }

        playBtn.addEventListener('click', async () => {
            if (isPlaying) {
                // Pause current song
                if (currentAudio) {
                    currentAudio.pause();
                }
                setStoppedState();
                clearInterval(nowPlayingInterval);
            } else {
                // Resume if paused, or start new song if stopped
                if (currentAudio && currentAudio.src && currentAudio.currentTime > 0) {
                    await audioContext.resume();
                    currentAudio.play();
                } else {
                    await initAudioContext();
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                    }
                    playNewSong(false); // No crossfade on first play
                    nowPlayingInterval = setInterval(updateNowPlaying, 10000);
                }
                setPlayingState();
            }
        });

        nextBtn.addEventListener('click', () => {
            if (isPlaying) {
                playNewSong(true); // Enable crossfade
            } else {
                playNewSong(false);
            }
        });

        prevBtn.addEventListener('click', () => {
            if (isPlaying) {
                playNewSong(true); // Enable crossfade
            } else {
                playNewSong(false);
            }
        });

        // Set up event listeners for current audio (will be updated when songs change)
        function setupAudioListeners(audio) {
            // Remove any existing listeners to prevent duplicates
            const events = ['loadedmetadata', 'timeupdate', 'ended', 'error', 'stalled'];
            events.forEach(event => {
                const existingListeners = audio.cloneNode ? [] : audio._listeners?.[event] || [];
                existingListeners.forEach(listener => {
                    audio.removeEventListener(event, listener);
                });
            });
            
            // Store listeners for cleanup
            if (!audio._listeners) audio._listeners = {};
            
            const metadataListener = () => {
                updateTimeline();
            };
            audio.addEventListener('loadedmetadata', metadataListener);
            audio._listeners.loadedmetadata = [metadataListener];

            const timeUpdateListener = () => {
                updateTimeline();
            };
            audio.addEventListener('timeupdate', timeUpdateListener);
            audio._listeners.timeupdate = [timeUpdateListener];

            const endedListener = () => {
                console.log('Song ended, checking if we should crossfade...');
                if (isPlaying && !isTransitioning) {
                    console.log('Starting crossfade to next song');
                    playNewSong(true); // Auto-crossfade to next song
                } else if (isTransitioning) {
                    console.log('Transition already in progress, ignoring ended event');
                } else {
                    console.log('Not playing, ignoring ended event');
                }
            };
            audio.addEventListener('ended', endedListener);
            audio._listeners.ended = [endedListener];

            const errorListener = (e) => {
                console.log('Audio error:', e);
                if (isPlaying && !isTransitioning) {
                    setTimeout(() => {
                        playNewSong(false);
                    }, 1000);
                }
            };
            audio.addEventListener('error', errorListener);
            audio._listeners.error = [errorListener];

            const stalledListener = () => {
                console.log('Audio stalled, retrying...');
                if (isPlaying && !isTransitioning) {
                    setTimeout(() => {
                        audio.load();
                        audio.play();
                    }, 2000);
                }
            };
            audio.addEventListener('stalled', stalledListener);
            audio._listeners.stalled = [stalledListener];
        }

        updateNowPlaying();
    </script>
</body>
</html>`;
}
