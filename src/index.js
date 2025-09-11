export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/stream') {
      return handleStream(env);
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

async function handleStream(env) {
  const playlist = await getPlaylist(env);
  if (playlist.length === 0) {
    return new Response('No songs available', { status: 404 });
  }
  
  const currentSong = playlist[Math.floor(Math.random() * playlist.length)];
  const audioObject = await env.MUSIC_BUCKET.get(currentSong);
  
  if (!audioObject) {
    return new Response('Song not found', { status: 404 });
  }
  
  await env.MUSIC_BUCKET.put('__current_song', currentSong);
  
  return new Response(audioObject.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleNowPlaying(env) {
  const currentSongKey = await env.MUSIC_BUCKET.get('__current_song');
  const songName = currentSongKey ? await currentSongKey.text() : 'Unknown';
  
  const verseInfo = extractVerseInfo(songName);
  
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
  
  const filename = `${Date.now()}-${file.name}`;
  await env.MUSIC_BUCKET.put(filename, file.stream());
  
  return new Response(`Uploaded: ${filename}`);
}

async function getPlaylist(env) {
  const objects = await env.MUSIC_BUCKET.list();
  return objects.objects.filter(obj => !obj.key.startsWith('__')).map(obj => obj.key);
}

function getPlayerHTML() {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Epic Scripture - Holy Bible Music Radio</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta charset="UTF-8">
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
                    }
                }
            }
        }
    </script>
</head>
<body class="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 font-sans overflow-hidden">
    <div class="h-screen flex flex-col items-center justify-center p-4 max-w-lg mx-auto">
        <div class="text-center mb-6">
            <div class="flex justify-center mb-3">
                <div class="relative">
                    <div class="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-xl">
                        <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11 2v7H4v2h7v11h2V11h7V9h-7V2h-2z"/>
                        </svg>
                    </div>
                    <div class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border border-white">
                        <span class="text-white text-xs font-bold">LIVE</span>
                    </div>
                </div>
            </div>
            
            <h1 class="text-2xl md:text-3xl font-serif font-bold text-transparent bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-400 bg-clip-text mb-2">
                Epic Scripture
            </h1>
            <div class="flex items-center justify-center space-x-2 text-white/90 text-sm">
                <i data-lucide="radio" class="w-4 h-4 text-yellow-400"></i>
                <span class="font-medium">24 Hours of Bible Music</span>
            </div>
        </div>

        <div class="w-full bg-white/5 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
            <div class="p-6 text-center">
                <div class="flex justify-center items-center space-x-4 mb-3">
                    <button id="prevBtn" class="w-12 h-12 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 transition-all duration-300 flex items-center justify-center shadow-xl transform hover:scale-105">
                        <i data-lucide="skip-back" class="w-5 h-5 text-white"></i>
                    </button>
                    
                    <button id="playBtn" class="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105">
                        <i id="playIcon" data-lucide="play" class="w-6 h-6 text-white ml-1"></i>
                        <i id="stopIcon" data-lucide="square" class="w-6 h-6 text-white hidden"></i>
                    </button>
                    
                    <button id="nextBtn" class="w-12 h-12 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 transition-all duration-300 flex items-center justify-center shadow-xl transform hover:scale-105">
                        <i data-lucide="skip-forward" class="w-5 h-5 text-white"></i>
                    </button>
                </div>
                <p id="status" class="text-white/90 text-sm font-medium">Press play to Hear the Word of God</p>
            </div>

            <div class="bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-blue-600/20 p-4 border-t border-white/10">
                <div class="text-center">
                    <div class="flex justify-center mb-2">
                        <i data-lucide="music" class="w-4 h-4 text-yellow-400"></i>
                    </div>
                    <p class="text-white/80 text-xs uppercase tracking-widest mb-2 font-serif">Now Playing</p>
                    <h3 id="songTitle" class="text-white font-semibold text-base mb-1 font-serif">Ready to Stream</h3>
                    <div class="flex items-center justify-center space-x-2">
                        <i data-lucide="book-open" class="w-3 h-3 text-yellow-400"></i>
                        <p id="verseInfo" class="text-yellow-300 text-xs font-medium">Scripture Music</p>
                    </div>
                </div>
            </div>

            <div class="p-3">
                <div class="flex justify-center space-x-6 text-white/70 text-xs">
                    <div class="flex items-center space-x-1">
                        <i data-lucide="radio" class="w-3 h-3 text-green-400"></i>
                        <span class="font-medium">STREAMING</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <i data-lucide="heart" class="w-3 h-3 text-red-400"></i>
                        <span class="font-medium">BLESSED</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <i data-lucide="clock" class="w-3 h-3 text-blue-400"></i>
                        <span class="font-medium">24/7</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-4 text-center text-white/60 text-xs">
            <p class="italic font-serif">"Let the word of Christ dwell in you richly"</p>
            <p class="text-white/50 mt-1">- Colossians 3:16</p>
        </div>
    </div>

    <script>
        lucide.createIcons();

        const playBtn = document.getElementById('playBtn');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
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
        let crossfadeTimeout = null;

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
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            return { source, gainNode };
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
            initAudioContext();
            
            // Create new audio element
            nextAudio = createAudioElement();
            nextAudio.src = '/stream?' + Date.now();
            
            const { gainNode } = connectAudioToContext(nextAudio);
            nextGain = gainNode;
            
            // Set up event listeners for this audio element
            setupAudioListeners(nextAudio);
            
            // Start with volume at 0 for crossfade
            if (crossfadeEnabled && currentAudio) {
                nextGain.gain.value = 0;
            } else {
                nextGain.gain.value = 1;
            }
            
            nextAudio.addEventListener('canplay', () => {
                if (isPlaying) {
                    nextAudio.play().then(() => {
                        if (crossfadeEnabled && currentAudio && currentGain) {
                            // Start crossfade
                            crossfade(currentGain, nextGain, 3000);
                            
                            // Clean up old audio after fade
                            setTimeout(() => {
                                if (currentAudio) {
                                    currentAudio.pause();
                                    currentAudio.src = '';
                                }
                            }, 3000);
                        }
                        
                        // Switch references
                        currentAudio = nextAudio;
                        currentGain = nextGain;
                        nextAudio = null;
                        nextGain = null;
                        
                        updateNowPlaying();
                    }).catch(() => {
                        status.textContent = 'Error loading stream';
                    });
                }
            });
            
            nextAudio.load();
        }

        function setPlayingState() {
            playBtn.className = 'w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105';
            playIcon.classList.add('hidden');
            stopIcon.classList.remove('hidden');
            status.textContent = 'Streaming blessed scripture music';
            isPlaying = true;
        }

        function setStoppedState() {
            playBtn.className = 'w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105';
            playIcon.classList.remove('hidden');
            stopIcon.classList.add('hidden');
            status.textContent = 'Press play to Hear the Word of God';
            isPlaying = false;
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
            audio.addEventListener('ended', () => {
                if (isPlaying) {
                    playNewSong(true); // Auto-crossfade to next song
                }
            });

            audio.addEventListener('error', (e) => {
                console.log('Audio error:', e);
                if (isPlaying) {
                    setTimeout(() => {
                        playNewSong(false);
                    }, 1000);
                }
            });

            audio.addEventListener('stalled', () => {
                console.log('Audio stalled, retrying...');
                if (isPlaying) {
                    setTimeout(() => {
                        audio.load();
                        audio.play();
                    }, 2000);
                }
            });
        }

        updateNowPlaying();
    </script>
</body>
</html>`;
}
