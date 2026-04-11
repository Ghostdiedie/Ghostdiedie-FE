import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CHARACTER_MODEL_PATHS, PLAYER_SCALE } from '../constants/game'
import { FighterBody } from './FighterBody'

/**
 * Player-controlled fighter.
 *
 * Props:
 *   movement      — from usePlayerMovement (position, isMoving, etc.)
 *   fighterState  — ref from useCombat (attackName, isHit, etc.)
 *   opponentPos   — ref<[x,y,z]> opponent's current world position
 */
export function PlayerCharacter({ movement, fighterState, opponentPos }) {
  const groupRef = useRef()

  useFrame(() => {
    if (!groupRef.current) return
    const pos = movement.position.current
    groupRef.current.position.set(pos[0], pos[1], pos[2])
  })

  return (
    <FighterBody
      groupRef={groupRef}
      modelPath={CHARACTER_MODEL_PATHS.blue}
      scale={PLAYER_SCALE}
      fighterState={fighterState}
      isMoving={movement.isMoving}
      isGrounded={movement.isGrounded}
      facingTarget={opponentPos}
      positionRef={movement.position}
    />
  )
}
