import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Scrubber Debug - Timeline Seeking', () => {
  let mockRequests = []
  
  beforeEach(() => {
    mockRequests = []
    vi.clearAllMocks()
  })

  it('should identify why scrubbing fails with random streams', () => {
    // Simulate current behavior
    function requestStream() {
      const timestamp = Date.now()
      const url = `/stream?${timestamp}`
      mockRequests.push(url)
      console.log(`Stream request: ${url}`)
      return {
        url,
        song: `random-song-${Math.floor(Math.random() * 100)}`,
        duration: 180 + Math.random() * 120 // 3-5 minutes
      }
    }

    // Simulate user trying to scrub
    const initialStream = requestStream()
    console.log(`Initial song: ${initialStream.song}`)
    
    // User tries to seek to 50% (90 seconds)
    const seekTime = initialStream.duration * 0.5
    console.log(`User wants to seek to: ${seekTime}s`)
    
    // Problem: Setting currentTime triggers new stream request
    const newStream = requestStream() // This gets a different song!
    console.log(`New song after seek: ${newStream.song}`)
    
    // Verify the problem
    expect(initialStream.song).not.toBe(newStream.song)
    expect(mockRequests.length).toBe(2)
    console.log('❌ Problem: Each seek gets a different random song')
  })

  it('should design solution with user session caching', () => {
    // Solution: Cache the current song for the user session
    const userSessions = new Map()
    
    function getOrCreateSession(userId = 'default') {
      if (!userSessions.has(userId)) {
        userSessions.set(userId, {
          currentSong: null,
          songUrl: null,
          startTime: Date.now(),
          seekPosition: 0
        })
      }
      return userSessions.get(userId)
    }
    
    function requestStreamWithSession(userId = 'default', seekTo = null) {
      const session = getOrCreateSession(userId)
      
      if (!session.currentSong || seekTo === null) {
        // First request or new song - get random song
        session.currentSong = `psalm-${Math.floor(Math.random() * 150)}`
        session.songUrl = `/stream/${session.currentSong}`
        session.startTime = Date.now()
        session.seekPosition = seekTo || 0
        console.log(`New song for session: ${session.currentSong}`)
      } else {
        // Seeking within current song
        session.seekPosition = seekTo
        console.log(`Seeking in ${session.currentSong} to ${seekTo}s`)
      }
      
      return {
        song: session.currentSong,
        url: session.songUrl,
        seekPosition: session.seekPosition,
        duration: 240 // 4 minutes
      }
    }
    
    // Test the solution
    const userId = 'user123'
    
    // Initial request
    const stream1 = requestStreamWithSession(userId)
    console.log(`Stream 1: ${stream1.song} at ${stream1.seekPosition}s`)
    
    // User seeks to 50%
    const stream2 = requestStreamWithSession(userId, 120)
    console.log(`Stream 2: ${stream2.song} at ${stream2.seekPosition}s`)
    
    // User seeks to 80%
    const stream3 = requestStreamWithSession(userId, 192)
    console.log(`Stream 3: ${stream3.song} at ${stream3.seekPosition}s`)
    
    // Verify solution works
    expect(stream1.song).toBe(stream2.song)
    expect(stream2.song).toBe(stream3.song)
    expect(stream2.seekPosition).toBe(120)
    expect(stream3.seekPosition).toBe(192)
    console.log('✅ Solution: Same song, different seek positions')
  })

  it('should test Range header implementation for seeking', () => {
    // Test HTTP Range requests for seeking
    function createRangeRequest(songFile, seekTimeSeconds, sampleRate = 44100, channels = 2, bytesPerSample = 2) {
      const bytesPerSecond = sampleRate * channels * bytesPerSample
      const startByte = Math.floor(seekTimeSeconds * bytesPerSecond)
      
      return {
        headers: {
          'Range': `bytes=${startByte}-`
        },
        songFile,
        startByte,
        seekTime: seekTimeSeconds
      }
    }
    
    // Test seeking to different positions
    const songFile = 'psalm-23.mp3'
    
    const seek30s = createRangeRequest(songFile, 30)
    const seek90s = createRangeRequest(songFile, 90)
    const seek150s = createRangeRequest(songFile, 150)
    
    console.log(`Seek to 30s: Range: ${seek30s.headers.Range}`)
    console.log(`Seek to 90s: Range: ${seek90s.headers.Range}`)
    console.log(`Seek to 150s: Range: ${seek150s.headers.Range}`)
    
    expect(seek30s.headers.Range).toContain('bytes=')
    expect(seek90s.startByte).toBeGreaterThan(seek30s.startByte)
    expect(seek150s.startByte).toBeGreaterThan(seek90s.startByte)
    console.log('✅ Range headers calculated correctly')
  })

  it('should design complete scrubber solution', () => {
    // Complete solution design
    const solution = {
      // 1. Session Management
      sessions: new Map(),
      
      // 2. Stream endpoint with session support
      handleStream(request, userId = 'default') {
        const url = new URL(request.url)
        const seekTo = url.searchParams.get('seek')
        const newSong = url.searchParams.get('new') === 'true'
        
        let session = this.sessions.get(userId)
        
        if (!session || newSong) {
          // Create new session or force new song
          session = {
            currentSong: `psalm-${Math.floor(Math.random() * 150)}`,
            startTime: Date.now(),
            duration: 180 + Math.random() * 120
          }
          this.sessions.set(userId, session)
        }
        
        const seekPosition = seekTo ? parseFloat(seekTo) : 0
        
        return {
          song: session.currentSong,
          seekPosition,
          duration: session.duration,
          url: `/audio/${session.currentSong}?seek=${seekPosition}`
        }
      },
      
      // 3. Client-side scrubber
      updateScrubber(audio, timeline) {
        timeline.addEventListener('input', () => {
          if (audio && audio.duration) {
            const seekTime = (timeline.value / 100) * audio.duration
            // Instead of setting currentTime, request new stream with seek
            this.seekToPosition(seekTime)
          }
        })
      },
      
      // 4. Seek implementation
      seekToPosition(seekTime) {
        const newUrl = `/stream?seek=${seekTime}`
        console.log(`Seeking to ${seekTime}s via ${newUrl}`)
        // Load new audio source with seek parameter
        return newUrl
      }
    }
    
    // Test the complete solution
    const mockRequest = { url: 'https://example.com/stream' }
    const stream1 = solution.handleStream(mockRequest, 'user1')
    
    const seekRequest = { url: 'https://example.com/stream?seek=90' }
    const stream2 = solution.handleStream(seekRequest, 'user1')
    
    expect(stream1.song).toBe(stream2.song) // Same song
    expect(stream2.seekPosition).toBe(90) // Different position
    console.log('✅ Complete scrubber solution designed')
  })
})
