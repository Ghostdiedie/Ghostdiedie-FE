import { useCallback, useEffect, useRef } from 'react'

const MOVE_PULSE_MS = 220
const JUMP_PULSE_MS = 180
const KEY_MAP = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  KeyQ: 'punchLeft',
  KeyE: 'kick',
  KeyF: 'punchRight',
  KeyR: 'headAttack',
}

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
    headAttack: false,
  }
}

export function useCVControls() {
  const keys = useRef(makeKeys())
  const combatEvents = useRef({
    punchLeft: false,
    kick: false,
    punchRight: false,
    headAttack: false,
  })
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
      case 'headbutt':
      case 'head attack':
        combatEvents.current.headAttack = true
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
      case 'walk forward':
        pulseKey('forward', MOVE_PULSE_MS)
        break
      case 'walk backward':
        pulseKey('backward', MOVE_PULSE_MS)
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
    combatEvents.current.headAttack = false
    return events
  }, [])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    const onDown = (e) => {
      const action = KEY_MAP[e.code]
      if (!action) return

      e.preventDefault()
      if (
        (action === 'punchLeft'
          || action === 'punchRight'
          || action === 'kick'
          || action === 'headAttack')
        && !keys.current[action]
      ) {
        combatEvents.current[action] = true
      }
      keys.current[action] = true
    }

    const onUp = (e) => {
      const action = KEY_MAP[e.code]
      if (!action) return

      e.preventDefault()
      keys.current[action] = false
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  return { keys, handleAction, consumeCombatEvents }
}
