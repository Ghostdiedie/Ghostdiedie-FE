import { useCallback, useEffect, useRef } from 'react'

const MOVE_PULSE_MS = 220
const JUMP_PULSE_MS = 180

function makeKeys() {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    punchLeft: false,
    kick: false,
    punchRight: false,
  }
}

export function useCVControls() {
  const keys = useRef(makeKeys())
  const combatEvents = useRef({ punchLeft: false, kick: false, punchRight: false })
  const timersRef = useRef({})

  const pulseKey = useCallback((key, duration) => {
    keys.current[key] = true
    clearTimeout(timersRef.current[key])
    timersRef.current[key] = setTimeout(() => {
      keys.current[key] = false
    }, duration)
  }, [])

  const handleAction = useCallback((action) => {
    switch (action) {
      case 'left punch':
        combatEvents.current.punchLeft = true
        break
      case 'right punch':
        combatEvents.current.punchRight = true
        break
      case 'both punch':
        combatEvents.current.punchLeft = true
        combatEvents.current.punchRight = true
        break
      case 'kick':
        combatEvents.current.kick = true
        break
      case 'jump':
        pulseKey('jump', JUMP_PULSE_MS)
        break
      case 'walk left':
        pulseKey('left', MOVE_PULSE_MS)
        break
      case 'walk right':
        pulseKey('right', MOVE_PULSE_MS)
        break
      default:
        console.log('[CVControls] ignored action', action)
    }
  }, [pulseKey])

  const consumeCombatEvents = useCallback(() => {
    const events = { ...combatEvents.current }
    combatEvents.current.punchLeft = false
    combatEvents.current.kick = false
    combatEvents.current.punchRight = false
    return events
  }, [])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  return { keys, handleAction, consumeCombatEvents }
}
