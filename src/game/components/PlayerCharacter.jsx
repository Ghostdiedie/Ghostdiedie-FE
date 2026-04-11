import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { GROUND_Y, PLAYER_COLORS, PLAYER_SCALE } from '../constants/game'
import { FighterBody } from './FighterBody'

/**
 * Player-controlled fighter.
 *
 * Props:
 *   movement      — from usePlayerMovement (position, isMoving, etc.)
 *   fighterState  — ref from useCombat (punchHand, isHit, etc.)
 *   opponentPos   — ref<[x,y,z]> opponent's current world position
 *   playerIndex   — 1 or 2 for color selection
 */
export function PlayerCharacter({ movement, fighterState, opponentPos, playerIndex = 1 }) {
  const groupRef = useRef()
  const color = PLAYER_COLORS[playerIndex]

  useFrame(() => {
    if (!groupRef.current) return
    const pos = movement.position.current
    groupRef.current.position.set(pos[0], pos[1], pos[2])
  })

  return (
    <FighterBody
      groupRef={groupRef}
      color={color}
      scale={PLAYER_SCALE}
      fighterState={fighterState}
      isMoving={movement.isMoving}
      facingTarget={opponentPos}
      positionRef={movement.position}
    />
  )
}
