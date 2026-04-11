import { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Arena } from './components/Arena'
import { PlayerCharacter } from './components/PlayerCharacter'
import { OpponentCharacter } from './components/OpponentCharacter'
import { FollowCamera } from './components/FollowCamera'
import { HUD } from './components/HUD'
import { useKeyboard } from './hooks/useKeyboard'
import { usePlayerMovement } from './hooks/usePlayerMovement'
import { useCombat } from './hooks/useCombat'
import { useOpponentAI } from './hooks/useOpponentAI'

function CombatUpdater({ combat, playerPos, opponentPos, playerFacing, opponentFacing }) {
  useFrame(() => {
    combat.update(
      playerPos.current,
      opponentPos.current,
      playerFacing.current,
      opponentFacing.current,
    )
  })
  return null
}

function Scene({ combat }) {
  const { keys, consumePunchEvents } = useKeyboard()

  // Opponent AI needs player position, player movement needs opponent position.
  // useOpponentAI creates its own position ref, we pass it to usePlayerMovement.
  const opponentAI = useOpponentAI(null, combat.opponentPunch) // playerPos patched below
  const movement = usePlayerMovement(keys, opponentAI.position)

  // Patch: give opponent AI the live player position ref
  opponentAI._playerPosRef.current = movement.position

  // Process punch inputs each frame
  useFrame(() => {
    const events = consumePunchEvents()
    if (events.punchLeft) combat.playerPunch('left')
    if (events.punchRight) combat.playerPunch('right')
  })

  return (
    <>
      {/* Lighting — bright warm colosseum */}
      <ambientLight intensity={0.6} color="#fff8e7" />
      <directionalLight
        position={[8, 15, 5]}
        intensity={2}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Warm hemisphere light — sky/ground */}
      <hemisphereLight args={['#87ceeb', '#e8d5a3', 0.5]} />

      {/* Light atmospheric fog */}
      <fog attach="fog" args={['#d4c5a0', 30, 60]} />

      {/* Sky color */}
      <color attach="background" args={['#87ceeb']} />

      {/* Arena */}
      <Arena />

      {/* Player (controllable) */}
      <PlayerCharacter
        movement={movement}
        fighterState={combat.player}
        opponentPos={opponentAI.position}
        playerIndex={1}
      />

      {/* Opponent (AI) */}
      <OpponentCharacter
        opponentAI={opponentAI}
        fighterState={combat.opponent}
        playerPos={movement.position}
      />

      {/* Combat hit detection updater */}
      <CombatUpdater
        combat={combat}
        playerPos={movement.position}
        opponentPos={opponentAI.position}
        playerFacing={movement.facing}
        opponentFacing={opponentAI.facing}
      />

      {/* Camera follows player */}
      <FollowCamera targetPosition={movement.position} />
    </>
  )
}

export function GameScene() {
  const combat = useCombat()

  return (
    <div className="relative h-screen w-screen">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <Scene combat={combat} />
        </Suspense>
      </Canvas>
      <HUD
        playerHp={combat.playerHp}
        opponentHp={combat.opponentHp}
        playerSkill={combat.playerSkill}
        opponentSkill={combat.opponentSkill}
      />
    </div>
  )
}
