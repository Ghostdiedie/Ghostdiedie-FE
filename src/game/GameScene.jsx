import { Suspense, useEffect } from 'react'
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
import { ARENA_RADIUS, ARENA_BOUNDARY_MARGIN, FIGHTER_MIN_DISTANCE, SEPARATION_MAX_PUSH } from './constants/game'

function clampToArena(pos) {
  const limit = ARENA_RADIUS - ARENA_BOUNDARY_MARGIN
  const dist = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2])
  if (dist > limit && dist > 0) {
    const scale = limit / dist
    pos[0] *= scale
    pos[2] *= scale
  }
}

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

function CharacterSeparation({ playerPosRef, opponentPosRef }) {
  useFrame(() => {
    const player   = playerPosRef.current
    const opponent = opponentPosRef.current

    let dx = opponent[0] - player[0]
    let dz = opponent[2] - player[2]
    let dist = Math.sqrt(dx * dx + dz * dz)

    if (dist === 0) { dx = 0; dz = 1; dist = 1 }
    if (dist >= FIGHTER_MIN_DISTANCE) return

    // Cap push per frame so separation is smooth, not a teleport
    const overlap = FIGHTER_MIN_DISTANCE - dist
    const push = Math.min(overlap * 0.5, SEPARATION_MAX_PUSH)
    const nx = dx / dist
    const nz = dz / dist

    player[0]   -= nx * push
    player[2]   -= nz * push
    opponent[0] += nx * push
    opponent[2] += nz * push

    clampToArena(player)
    clampToArena(opponent)
  })

  return null
}

function Scene({ combat }) {
  const { keys, consumeCombatEvents } = useKeyboard()

  // Opponent AI needs player position, player movement needs opponent position.
  // useOpponentAI creates its own position ref, we pass it to usePlayerMovement.
  const opponentAI = useOpponentAI(null, combat.opponentPunch, combat.opponentKick) // playerPos patched below
  const { setPlayerPositionRef } = opponentAI
  const movement = usePlayerMovement(keys, opponentAI.position)

  useEffect(() => {
    setPlayerPositionRef(movement.position)
  }, [movement.position, setPlayerPositionRef])

  // Process combat inputs each frame
  useFrame(() => {
    const events = consumeCombatEvents()
    if (events.punchLeft) combat.playerPunch('left')
    if (events.kick) combat.playerKick()
    if (events.punchRight) combat.playerPunch('right')
  })

  return (
    <>
      {/* ── Lighting: warehouse arena ─────────────────────────── */}

      {/* Warm ambient fill — makes the whole space readable */}
      <ambientLight intensity={0.55} color="#c8b888" />

      {/* THE BIG CEILING LIGHT — main shadow caster */}
      <pointLight
        position={[0, 8, 0]}
        intensity={70}
        color="#fff4d0"
        distance={45}
        decay={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
      />

      {/* 4 side-fill from the floodlight pods */}
      <pointLight position={[-7, 7.5, 0]}  intensity={18} color="#ffe8a0" distance={30} decay={2} />
      <pointLight position={[ 7, 7.5, 0]}  intensity={18} color="#ffe8a0" distance={30} decay={2} />
      <pointLight position={[0,  7.5, -7]} intensity={18} color="#ffe8a0" distance={30} decay={2} />
      <pointLight position={[0,  7.5,  7]} intensity={18} color="#ffe8a0" distance={30} decay={2} />

      {/* Mild haze — you can see the whole arena */}
      <fog attach="fog" args={['#1a1612', 32, 62]} />

      {/* Background — dark warehouse */}
      <color attach="background" args={['#161410']} />

      {/* Arena */}
      <Arena />

      {/* Player (controllable) */}
      <PlayerCharacter
        movement={movement}
        fighterState={combat.player}
        opponentPos={opponentAI.position}
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

      <CharacterSeparation
        playerPosRef={movement.position}
        opponentPosRef={opponentAI.position}
      />

      {/* Camera follows player from behind */}
      <FollowCamera
        targetPosition={movement.position}
        playerFacing={movement.facing}
        opponentPosition={opponentAI.position}
      />
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
