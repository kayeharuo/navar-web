let audioContext
let audioUnlocked = false
let lastPlayedAt = 0

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  audioContext ||= new AudioContext()
  return audioContext
}

export async function unlockNotificationSound() {
  const context = getAudioContext()
  if (!context) return
  audioUnlocked = true
  if (context.state === 'suspended') {
    try {
      await context.resume()
    } catch {
      audioUnlocked = false
    }
  }
}

export async function playNotificationSound(kind = 'notification') {
  const context = getAudioContext()
  if (!context || !audioUnlocked) return
  if (context.state === 'suspended') {
    try {
      await context.resume()
    } catch {
      return
    }
  }
  const nowMs = Date.now()
  if (nowMs - lastPlayedAt < 400) return
  lastPlayedAt = nowMs

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime
  const frequency = kind === 'thread' ? 740 : 560

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(kind === 'thread' ? 0.18 : 0.12, now + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.3)
}
