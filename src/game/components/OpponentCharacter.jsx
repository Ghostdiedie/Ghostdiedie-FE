import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PLAYER_COLORS, PLAYER_SCALE } from '../constants/game'
import { FighterBody } from './FighterBody'

/**
 * AI-controlled opponent fighter.
 *
 * Props:
 *   opponentAI    — from useOpponentAI (position, facing, isMoving)
 *   fighterState  — ref from useCombat (punchHand, isHit, etc.)
 *   playerPos     — ref<[x,y,z]> player's current position (to face toward)
 */
export function OpponentCharacter({ opponentAI, fighterState, playerPos }) {
  const groupRef = useRef()
  const color = PLAYER_COLORS[2]

  useFrame(() => {
    if (!groupRef.current) return
    const pos = opponentAI.position.current
    groupRef.current.position.set(pos[0], pos[1], pos[2])
  })

  return (
    <FighterBody
      groupRef={groupRef}
      color={color}
      scale={PLAYER_SCALE}
      fighterState={fighterState}
      isMoving={opponentAI.isMoving}
      facingTarget={playerPos}
      positionRef={opponentAI.position}
    />
  )
}
