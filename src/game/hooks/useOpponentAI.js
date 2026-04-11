import { useCallback, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { GROUND_Y } from '../constants/game'

/**
 * Simple opponent AI: moves toward/away from player to maintain distance,
 * then randomly attacks when in range.
 *
 * playerPositionRef can be null initially — set _playerPosRef.current after init
 * to resolve circular dependency with usePlayerMovement.
 */
export function useOpponentAI(playerPositionRef) {
  const position = useRef([0, GROUND_Y, -5])
  const facing = useRef(0)
  const isMoving = useRef(false)

  // Indirection ref to resolve circular dependency
  const _playerPosRef = useRef(playerPositionRef)
  const setPlayerPositionRef = useCallback((nextPlayerPositionRef) => {
    _playerPosRef.current = nextPlayerPositionRef
  }, [])

  useFrame(() => {
    const playerRef = _playerPosRef.current
    if (!playerRef) return
    const playerPos = playerRef.current

    const pos = position.current

    // Face the player (but stay still)
    const dx = playerPos[0] - pos[0]
    const dz = playerPos[2] - pos[2]
    facing.current = Math.atan2(dx, dz)

    isMoving.current = false
    pos[1] = GROUND_Y
  })

  return { position, facing, isMoving, setPlayerPositionRef }
}
