import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock Web Audio API
const mockAudioContext = {
  createMediaElementSource: vi.fn(() => ({
    connect: vi.fn()
  })),
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn()
  })),
  destination: {},
  resume: vi.fn(() => Promise.resolve()),
  state: 'running'
}

const mockAudio = {
  src: '',
  currentTime: 0,
  duration: 100,
  paused: true,
  seekable: { length: 1 },
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}

// Mock global Audio constructor
global.Audio = vi.fn(() => mockAudio)
global.AudioContext = vi.fn(() => mockAudioContext)
global.webkitAudioContext = vi.fn(() => mockAudioContext)

describe('Audio Player State Management', () => {
  let playerState
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Initialize player state
    playerState = {
      currentAudio: null,
      nextAudio: null,
      currentGain: null,
      nextGain: null,
      isPlaying: false,
      isTransitioning: false,
      audioContext: null
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Transition State Management', () => {
    it('should prevent multiple simultaneous transitions', () => {
      playerState.isTransitioning = true
      
      // Simulate playNewSong call
      function playNewSong() {
        if (playerState.isTransitioning) {
          console.log('Transition already in progress, ignoring...')
          return false
        }
        playerState.isTransitioning = true
        return true
      }
      
      const result1 = playNewSong()
      const result2 = playNewSong() // Should be blocked
      
      expect(result1).toBe(false) // First call blocked because already transitioning
      expect(result2).toBe(false) // Second call also blocked
    })

    it('should allow transition after cooldown period', async () => {
      playerState.isTransitioning = false
      
      function playNewSong() {
        if (playerState.isTransitioning) {
          return false
        }
        playerState.isTransitioning = true
        
        // Simulate transition completion
        setTimeout(() => {
          playerState.isTransitioning = false
        }, 1000)
        
        return true
      }
      
      const result1 = playNewSong()
      expect(result1).toBe(true)
      expect(playerState.isTransitioning).toBe(true)
      
      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      const result2 = playNewSong()
      expect(result2).toBe(true)
    })
  })

  describe('Audio Event Handling', () => {
    it('should handle ended event only when playing and not transitioning', () => {
      let endedCallbacks = []
      
      // Mock addEventListener to capture ended event
      mockAudio.addEventListener = vi.fn((event, callback) => {
        if (event === 'ended') {
          endedCallbacks.push(callback)
        }
      })
      
      // Simulate audio setup
      playerState.currentAudio = mockAudio
      playerState.isPlaying = true
      playerState.isTransitioning = false
      
      // Add event listener
      playerState.currentAudio.addEventListener('ended', () => {
        if (playerState.isPlaying && !playerState.isTransitioning) {
          playerState.isTransitioning = true
          console.log('Starting crossfade')
        }
      })
      
      // Trigger ended event
      endedCallbacks.forEach(cb => cb())
      
      expect(playerState.isTransitioning).toBe(true)
    })

    it('should ignore ended event when already transitioning', () => {
      let endedCallbacks = []
      let crossfadeStarted = false
      
      mockAudio.addEventListener = vi.fn((event, callback) => {
        if (event === 'ended') {
          endedCallbacks.push(callback)
        }
      })
      
      playerState.currentAudio = mockAudio
      playerState.isPlaying = true
      playerState.isTransitioning = true // Already transitioning
      
      playerState.currentAudio.addEventListener('ended', () => {
        if (playerState.isPlaying && !playerState.isTransitioning) {
          crossfadeStarted = true
        }
      })
      
      // Trigger ended event
      endedCallbacks.forEach(cb => cb())
      
      expect(crossfadeStarted).toBe(false)
    })
  })

  describe('Audio Reference Management', () => {
    it('should properly clean up audio references during transition', () => {
      const oldAudio = { ...mockAudio, pause: vi.fn(), src: 'old' }
      const newAudio = { ...mockAudio, src: 'new' }
      
      playerState.currentAudio = oldAudio
      playerState.nextAudio = newAudio
      
      // Simulate transition completion
      function completeTransition() {
        if (playerState.nextAudio) {
          // Clean up old audio
          if (playerState.currentAudio) {
            playerState.currentAudio.pause()
            playerState.currentAudio.src = ''
          }
          
          // Switch references
          playerState.currentAudio = playerState.nextAudio
          playerState.nextAudio = null
        }
      }
      
      completeTransition()
      
      expect(oldAudio.pause).toHaveBeenCalled()
      expect(oldAudio.src).toBe('')
      expect(playerState.currentAudio).toBe(newAudio)
      expect(playerState.nextAudio).toBe(null)
    })
  })

  describe('Timeline Updates', () => {
    it('should update timeline without interfering with audio playback', () => {
      const timelineElement = { 
        value: 0, 
        style: { background: '' } 
      }
      
      playerState.currentAudio = {
        ...mockAudio,
        currentTime: 50,
        duration: 100
      }
      
      function updateTimeline() {
        if (playerState.currentAudio && !isNaN(playerState.currentAudio.duration)) {
          const progress = (playerState.currentAudio.currentTime / playerState.currentAudio.duration) * 100
          timelineElement.value = progress
          timelineElement.style.background = `linear-gradient(to right, #f59e0b ${progress}%, rgba(255,255,255,0.3) ${progress}%)`
        }
      }
      
      updateTimeline()
      
      expect(timelineElement.value).toBe(50)
      expect(timelineElement.style.background).toContain('50%')
    })
  })
})

describe('Crossfade Logic', () => {
  it('should handle crossfade without creating audio loops', () => {
    let gainNodes = []
    
    function createGainNode() {
      const node = {
        gain: { value: 1 },
        connect: vi.fn()
      }
      gainNodes.push(node)
      return node
    }
    
    function crossfade(fromGain, toGain, duration = 3000) {
      const steps = 60
      const stepTime = duration / steps
      let step = 0
      
      const fadeInterval = setInterval(() => {
        step++
        const progress = step / steps
        
        if (fromGain) {
          fromGain.gain.value = Math.max(0, 1 - progress)
        }
        
        if (toGain) {
          toGain.gain.value = Math.min(1, progress)
        }
        
        if (step >= steps) {
          clearInterval(fadeInterval)
        }
      }, stepTime)
      
      return fadeInterval
    }
    
    const fromGain = createGainNode()
    const toGain = createGainNode()
    
    fromGain.gain.value = 1
    toGain.gain.value = 0
    
    const fadeInterval = crossfade(fromGain, toGain, 100) // Short duration for test
    
    // Wait for crossfade to complete
    return new Promise(resolve => {
      setTimeout(() => {
        expect(fromGain.gain.value).toBe(0)
        expect(toGain.gain.value).toBe(1)
        clearInterval(fadeInterval)
        resolve()
      }, 150)
    })
  })
})
