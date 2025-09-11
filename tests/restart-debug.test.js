import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

describe('Random Restart Debug', () => {
  let eventLog = []
  let audioInstances = []
  let timelineUpdates = []
  
  beforeEach(() => {
    eventLog = []
    audioInstances = []
    timelineUpdates = []
    vi.clearAllMocks()
  })

  // Mock Audio with detailed logging
  const createMockAudio = (id) => {
    const audio = {
      id,
      src: '',
      currentTime: 0,
      duration: 100,
      paused: true,
      seekable: { length: 1 },
      eventListeners: {},
      
      play: vi.fn(() => {
        eventLog.push(`Audio ${id}: play() called`)
        audio.paused = false
        return Promise.resolve()
      }),
      
      pause: vi.fn(() => {
        eventLog.push(`Audio ${id}: pause() called`)
        audio.paused = true
      }),
      
      load: vi.fn(() => {
        eventLog.push(`Audio ${id}: load() called`)
      }),
      
      addEventListener: vi.fn((event, callback) => {
        if (!audio.eventListeners[event]) {
          audio.eventListeners[event] = []
        }
        audio.eventListeners[event].push(callback)
        eventLog.push(`Audio ${id}: addEventListener('${event}')`)
      }),
      
      set src(value) {
        eventLog.push(`Audio ${id}: src set to '${value}'`)
        this._src = value
        
        // Simulate src change triggering events
        if (value === '') {
          eventLog.push(`Audio ${id}: src cleared - potential restart trigger`)
        }
      },
      
      get src() {
        return this._src || ''
      },
      
      set currentTime(value) {
        eventLog.push(`Audio ${id}: currentTime set to ${value}`)
        this._currentTime = value
        
        // Simulate seeking behavior
        if (value === 0 && this._currentTime > 0) {
          eventLog.push(`Audio ${id}: POTENTIAL RESTART - currentTime reset to 0`)
        }
      },
      
      get currentTime() {
        return this._currentTime || 0
      }
    }
    
    audioInstances.push(audio)
    return audio
  }

  global.Audio = vi.fn((src) => {
    const id = audioInstances.length + 1
    eventLog.push(`Creating new Audio instance ${id}`)
    return createMockAudio(id)
  })

  it('should identify what causes random restarts', async () => {
    // Simulate the player state
    let playerState = {
      currentAudio: null,
      nextAudio: null,
      isPlaying: false,
      isTransitioning: false
    }

    // Simulate timeline update function
    function updateTimeline() {
      if (playerState.currentAudio && !isNaN(playerState.currentAudio.duration)) {
        const progress = (playerState.currentAudio.currentTime / playerState.currentAudio.duration) * 100
        timelineUpdates.push({
          audioId: playerState.currentAudio.id,
          currentTime: playerState.currentAudio.currentTime,
          progress
        })
      }
    }

    // Simulate playNewSong function
    function playNewSong() {
      if (playerState.isTransitioning) {
        eventLog.push('playNewSong: Blocked - already transitioning')
        return
      }
      
      playerState.isTransitioning = true
      eventLog.push('playNewSong: Starting transition')
      
      // Create new audio
      playerState.nextAudio = new Audio()
      playerState.nextAudio.src = '/stream?' + Date.now()
      
      // Simulate canplay event
      setTimeout(() => {
        if (playerState.nextAudio && playerState.isPlaying) {
          playerState.nextAudio.play()
          
          // Clean up old audio
          if (playerState.currentAudio) {
            playerState.currentAudio.pause()
            playerState.currentAudio.src = '' // This might cause issues
          }
          
          // Switch references
          playerState.currentAudio = playerState.nextAudio
          playerState.nextAudio = null
          
          setTimeout(() => {
            playerState.isTransitioning = false
            eventLog.push('playNewSong: Transition complete')
          }, 100)
        }
      }, 50)
    }

    // Simulate ended event handler
    function onEnded() {
      eventLog.push('onEnded: Song ended')
      if (playerState.isPlaying && !playerState.isTransitioning) {
        eventLog.push('onEnded: Triggering crossfade')
        playNewSong()
      } else {
        eventLog.push('onEnded: Ignoring (not playing or transitioning)')
      }
    }

    // Start playing
    playerState.isPlaying = true
    playerState.currentAudio = new Audio()
    playerState.currentAudio.src = '/stream?initial'
    playerState.currentAudio.play()

    // Simulate timeline updates
    const timelineInterval = setInterval(updateTimeline, 100)

    // Simulate multiple ended events (the suspected cause)
    setTimeout(() => onEnded(), 200)
    setTimeout(() => onEnded(), 210) // Rapid second event
    setTimeout(() => onEnded(), 220) // Rapid third event

    // Wait for all events to process
    await new Promise(resolve => setTimeout(resolve, 500))
    clearInterval(timelineInterval)

    // Analyze the event log
    console.log('\n=== EVENT LOG ===')
    eventLog.forEach((event, i) => console.log(`${i + 1}: ${event}`))

    console.log('\n=== TIMELINE UPDATES ===')
    timelineUpdates.forEach((update, i) => 
      console.log(`${i + 1}: Audio ${update.audioId} - Time: ${update.currentTime}, Progress: ${update.progress}%`)
    )

    console.log('\n=== AUDIO INSTANCES ===')
    audioInstances.forEach((audio, i) => 
      console.log(`Audio ${audio.id}: src='${audio.src}', currentTime=${audio.currentTime}, paused=${audio.paused}`)
    )

    // Check for restart indicators
    const restartIndicators = eventLog.filter(event => 
      event.includes('POTENTIAL RESTART') || 
      event.includes('src cleared') ||
      event.includes('currentTime set to 0')
    )

    console.log('\n=== RESTART INDICATORS ===')
    restartIndicators.forEach(indicator => console.log(`⚠️  ${indicator}`))

    // Assertions
    expect(audioInstances.length).toBeGreaterThan(1) // Should create multiple audio instances
    expect(eventLog.filter(e => e.includes('playNewSong: Blocked')).length).toBeGreaterThan(0) // Should block duplicate calls
  })

  it('should test if rapid timeline updates cause restarts', () => {
    const audio = createMockAudio(1)
    audio.currentTime = 50
    audio.duration = 100

    // Simulate rapid timeline updates
    for (let i = 0; i < 10; i++) {
      audio.currentTime = 50 + i
    }

    // Check if any updates reset to 0
    const resets = eventLog.filter(e => e.includes('currentTime set to 0'))
    expect(resets.length).toBe(0) // Should not reset during normal updates
  })

  it('should test if multiple event listeners cause issues', () => {
    const audio = createMockAudio(1)
    
    // Add multiple ended event listeners (potential issue)
    audio.addEventListener('ended', () => eventLog.push('Ended listener 1'))
    audio.addEventListener('ended', () => eventLog.push('Ended listener 2'))
    audio.addEventListener('ended', () => eventLog.push('Ended listener 3'))

    // Simulate ended event
    if (audio.eventListeners.ended) {
      audio.eventListeners.ended.forEach(callback => callback())
    }

    const endedEvents = eventLog.filter(e => e.includes('Ended listener'))
    console.log(`Multiple ended listeners fired: ${endedEvents.length}`)
    
    expect(endedEvents.length).toBe(3) // All listeners should fire
  })
})
