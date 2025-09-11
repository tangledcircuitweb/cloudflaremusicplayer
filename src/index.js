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
<body class="h-screen font-sans overflow-hidden">
    <div class="h-screen flex flex-col items-center justify-center p-4 max-w-lg mx-auto">
        <div class="text-center mb-6">
            <h1 class="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-transparent bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-700 bg-clip-text mb-4 drop-shadow-lg filter brightness-110 whitespace-nowrap">
                Epic Scripture
            </h1>
            <div class="flex items-center justify-center space-x-2 text-gray-700 text-sm">
                <i data-lucide="radio" class="w-4 h-4 text-amber-600 drop-shadow-sm"></i>
                <span class="font-medium drop-shadow-sm">24 Hours of Bible Music</span>
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
                            <input type="range" id="timeline" min="0" max="100" value="0" 
                                   class="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer glass-button"
                                   style="background: linear-gradient(to right, #f59e0b 0%, #f59e0b 0%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.3) 100%);">
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
                        <i data-lucide="radio" class="w-3 h-3 text-green-500 drop-shadow-sm"></i>
                        <span class="font-medium drop-shadow-sm">STREAMING</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <i data-lucide="heart" class="w-3 h-3 text-red-400 drop-shadow-sm"></i>
                        <span class="font-medium drop-shadow-sm">BLESSED</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <i data-lucide="clock" class="w-3 h-3 text-blue-400 drop-shadow-sm"></i>
                        <span class="font-medium drop-shadow-sm">24/7</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-4 text-center text-gray-600 text-xs glass-intense rounded-xl p-3">
            <p class="italic font-serif drop-shadow-sm">"Sing to the Lord a new song"</p>
            <p class="text-gray-500 mt-1 drop-shadow-sm">- Psalm 96:1</p>
        </div>
    </div>

    <script>
        lucide.createIcons();

        const playBtn = document.getElementById('playBtn');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const timeline = document.getElementById('timeline');
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

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }

        let isScrubbing = false;

        function updateTimeline() {
            if (currentAudio && !isNaN(currentAudio.duration) && !isScrubbing) {
                const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
                timeline.value = progress;
                timeline.style.background = 'linear-gradient(to right, #f59e0b ' + progress + '%, rgba(255,255,255,0.3) ' + progress + '%)';
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

        // Timeline scrubber functionality
        timeline.addEventListener('mousedown', () => {
            isScrubbing = true;
        });

        timeline.addEventListener('mouseup', () => {
            isScrubbing = false;
            if (currentAudio && !isNaN(currentAudio.duration) && currentAudio.duration > 0) {
                const newTime = (timeline.value / 100) * currentAudio.duration;
                currentAudio.currentTime = newTime;
                updateTimeline();
            }
        });

        timeline.addEventListener('input', () => {
            if (currentAudio && !isNaN(currentAudio.duration) && currentAudio.duration > 0) {
                const newTime = (timeline.value / 100) * currentAudio.duration;
                const progress = timeline.value;
                timeline.style.background = 'linear-gradient(to right, #f59e0b ' + progress + '%, rgba(255,255,255,0.3) ' + progress + '%)';
                currentTimeEl.textContent = formatTime(newTime);
            }
        });

        timeline.addEventListener('change', () => {
            if (currentAudio && !isNaN(currentAudio.duration) && currentAudio.duration > 0) {
                const newTime = (timeline.value / 100) * currentAudio.duration;
                currentAudio.currentTime = newTime;
                updateTimeline();
            }
        });

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
            playBtn.className = 'w-16 h-16 rounded-full bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105 border-2 border-white/40 glass-button';
            playIcon.classList.add('hidden');
            stopIcon.classList.remove('hidden');
            status.textContent = 'Streaming the Word of God';
            isPlaying = true;
            startTimeUpdates();
        }

        function setStoppedState() {
            playBtn.className = 'w-16 h-16 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 transition-all duration-300 flex items-center justify-center shadow-2xl transform hover:scale-105 border-2 border-white/40 glass-button';
            playIcon.classList.remove('hidden');
            stopIcon.classList.add('hidden');
            status.textContent = 'Press play to Hear the Word of God';
            isPlaying = false;
            stopTimeUpdates();
            timeline.value = 0;
            timeline.style.background = 'linear-gradient(to right, #f59e0b 0%, rgba(255,255,255,0.3) 0%)';
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
            audio.addEventListener('loadedmetadata', () => {
                updateTimeline();
            });

            audio.addEventListener('timeupdate', () => {
                updateTimeline();
            });

            audio.addEventListener('ended', () => {
                console.log('Song ended, starting crossfade...');
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
