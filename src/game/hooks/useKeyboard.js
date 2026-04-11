import { useEffect, useRef, useCallback } from 'react'

const KEY_MAP = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  KeyQ: 'punchLeft',
  KeyE: 'kick',
  KeyF: 'punchRight',
}

export function useKeyboard() {
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    punchLeft: false,
    kick: false,
    punchRight: false,
  })

  // Track attack key-down edges (true only on the frame the key goes down)
  const combatEvents = useRef({ punchLeft: false, kick: false, punchRight: false })

  const consumeCombatEvents = useCallback(() => {
    const events = { ...combatEvents.current }
    combatEvents.current.punchLeft = false
    combatEvents.current.kick = false
    combatEvents.current.punchRight = false
    return events
  }, [])

  useEffect(() => {
    const onDown = (e) => {
      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
        // Fire attack event only on initial key-down, not on repeat
        if ((action === 'punchLeft' || action === 'punchRight' || action === 'kick') && !keys.current[action]) {
          combatEvents.current[action] = true
        }
        keys.current[action] = true
      }
    }

    const onUp = (e) => {
      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
        keys.current[action] = false
      }
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  return { keys, consumeCombatEvents }
}
