import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BOT_MOVE_SPEED,
  BOT_PREFERRED_DISTANCE,
  BOT_PUNCH_CHANCE,
  BOT_PUNCH_RANGE,
} from '../constants/combat'
import { ARENA_RADIUS, GROUND_Y } from '../constants/game'

/**
 * Simple opponent AI: moves toward/away from player to maintain distance,
 * then randomly punches when in range.
 *
 * playerPositionRef can be null initially — set _playerPosRef.current after init
 * to resolve circular dependency with usePlayerMovement.
 */
export function useOpponentAI(playerPositionRef, opponentPunch) {
  const position = useRef([0, GROUND_Y, -5])
  const facing = useRef(0)
  const isMoving = useRef(false)

  // Indirection ref to resolve circular dependency
  const _playerPosRef = useRef(playerPositionRef)

  useFrame(() => {
    const playerRef = _playerPosRef.current
    if (!playerRef) return
    const playerPos = playerRef.current

    const pos = position.current

    // Direction to player
    const dx = playerPos[0] - pos[0]
    const dz = playerPos[2] - pos[2]
    const dist = Math.sqrt(dx * dx + dz * dz)

    // Face the player
    facing.current = Math.atan2(dx, dz)

    // Move toward preferred distance
    if (dist > 0.01) {
      const nx = dx / dist
      const nz = dz / dist

      if (dist > BOT_PREFERRED_DISTANCE + 0.5) {
        pos[0] += nx * BOT_MOVE_SPEED
        pos[2] += nz * BOT_MOVE_SPEED
        isMoving.current = true
      } else if (dist < BOT_PREFERRED_DISTANCE - 0.5) {
        pos[0] -= nx * BOT_MOVE_SPEED * 0.5
        pos[2] -= nz * BOT_MOVE_SPEED * 0.5
        isMoving.current = true
      } else {
        isMoving.current = false
      }
    }

    // Keep bot inside arena
    const margin = 1.5
    const limit = ARENA_RADIUS - margin
    const botDist = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2])
    if (botDist > limit) {
      const scale = limit / botDist
      pos[0] *= scale
      pos[2] *= scale
    }

    // Keep on ground
    pos[1] = GROUND_Y

    // Random punching when in range
    if (dist < BOT_PUNCH_RANGE) {
      if (Math.random() < BOT_PUNCH_CHANCE) {
        const hand = Math.random() < 0.5 ? 'left' : 'right'
        opponentPunch(hand)
      }
    }
  })

  return { position, facing, isMoving, _playerPosRef }
}
