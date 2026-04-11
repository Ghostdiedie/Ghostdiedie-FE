import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CHARACTER_MODEL_PATHS, PLAYER_SCALE } from '../constants/game'
import { FighterBody } from './FighterBody'

/**
 * AI-controlled opponent fighter.
 *
 * Props:
 *   opponentAI    — from useOpponentAI (position, facing, isMoving)
 *   fighterState  — ref from useCombat (attackName, isHit, etc.)
 *   playerPos     — ref<[x,y,z]> player's current position (to face toward)
 */
export function OpponentCharacter({ opponentAI, fighterState, playerPos }) {
  const groupRef = useRef()

  useFrame(() => {
    if (!groupRef.current) return
    const pos = opponentAI.position.current
    groupRef.current.position.set(pos[0], pos[1], pos[2])
  })

  return (
    <FighterBody
      groupRef={groupRef}
      modelPath={CHARACTER_MODEL_PATHS.red}
      scale={PLAYER_SCALE}
      fighterState={fighterState}
      isMoving={opponentAI.isMoving}
      facingTarget={playerPos}
      positionRef={opponentAI.position}
    />
  )
}
