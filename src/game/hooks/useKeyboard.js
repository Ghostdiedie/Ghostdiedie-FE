import { useEffect, useRef, useCallback } from 'react'

const KEY_MAP = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  KeyQ: 'punchLeft',
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
    punchRight: false,
  })

  // Track punch key-down edges (true only on the frame the key goes down)
  const punchEvents = useRef({ punchLeft: false, punchRight: false })

  const consumePunchEvents = useCallback(() => {
    const events = { ...punchEvents.current }
    punchEvents.current.punchLeft = false
    punchEvents.current.punchRight = false
    return events
  }, [])

  useEffect(() => {
    const onDown = (e) => {
      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
        // Fire punch event only on initial key-down, not on repeat
        if ((action === 'punchLeft' || action === 'punchRight') && !keys.current[action]) {
          punchEvents.current[action] = true
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

  return { keys, consumePunchEvents }
}
