import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
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
  useFrame((_, delta) => {
    combat.update(
      playerPos.current,
      opponentPos.current,
      playerFacing.current,
      opponentFacing.current,
      delta,
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

function Scene({ combat, playerFaceUrl }) {
  const { keys, consumeCombatEvents } = useKeyboard()

  // Opponent AI needs player position, player movement needs opponent position.
  // useOpponentAI creates its own position ref, we pass it to usePlayerMovement.
  const opponentAI = useOpponentAI(null) // playerPos patched below
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

      {/* Crowd area lights — illuminate spectators around the cage */}
      <pointLight position={[-16, 4, -16]} intensity={12} color="#ffd8a0" distance={22} decay={1.8} />
      <pointLight position={[ 16, 4, -16]} intensity={12} color="#ffd8a0" distance={22} decay={1.8} />
      <pointLight position={[-16, 4,  16]} intensity={12} color="#ffd8a0" distance={22} decay={1.8} />
      <pointLight position={[ 16, 4,  16]} intensity={12} color="#ffd8a0" distance={22} decay={1.8} />

      {/* Mild haze — pushed back so crowd is visible */}
      <fog attach="fog" args={['#1a1612', 38, 70]} />

      {/* Background — dark warehouse */}
      <color attach="background" args={['#161410']} />

      {/* Arena */}
      <Arena />

      {/* Player (controllable) */}
      <PlayerCharacter
        movement={movement}
        fighterState={combat.player}
        opponentPos={opponentAI.position}
        faceImageUrl={playerFaceUrl}
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

const COUNTDOWN_SEQUENCE = [5, 4, 3, 2, 1, 'FIGHT!']

function LoadingTracker({ onLoaded }) {
  const { active } = useProgress()
  const calledRef = useRef(false)

  if (!active && !calledRef.current) {
    calledRef.current = true
    // Schedule callback after render to avoid cascading setState in effect
    queueMicrotask(onLoaded)
  }

  return null
}

function CountdownOverlay({ onComplete }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (step >= COUNTDOWN_SEQUENCE.length) {
      onComplete()
      return
    }

    const isFight = COUNTDOWN_SEQUENCE[step] === 'FIGHT!'
    const showFor  = isFight ? 900 : 650
    const totalFor = isFight ? 1400 : 1000

    const t1 = setTimeout(() => setVisible(false), showFor)
    const t2 = setTimeout(() => {
      setStep(s => s + 1)
      setVisible(true)
    }, totalFor)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onComplete, step])

  if (step >= COUNTDOWN_SEQUENCE.length) return null

  const current = COUNTDOWN_SEQUENCE[step]
  const isFight = current === 'FIGHT!'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none select-none">
      {/* Semi-transparent backdrop that fades as countdown progresses */}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-500"
        style={{ opacity: Math.max(0, 1 - step * 0.15) }}
      />
      <div
        className={[
          'relative z-10 transition-[opacity,transform] duration-220 ease-out',
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.3]',
        ].join(' ')}
      >
        {isFight ? (
          <span className="font-black tracking-[0.05em] text-red-500 text-[clamp(4rem,12vw,7rem)] drop-shadow-[0_0_40px_rgba(239,68,68,0.5)]">
            FIGHT!
          </span>
        ) : (
          <span className="font-black text-white text-[clamp(10rem,28vw,18rem)] leading-none drop-shadow-[0_0_60px_rgba(255,255,255,0.3)]">
            {current}
          </span>
        )}
      </div>
    </div>
  )
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-60 flex flex-col items-center justify-center bg-black/80 select-none">
      {/* Spinner */}
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
      <p className="text-white text-lg font-semibold tracking-wide">Loading Arena...</p>
      <p className="text-white/50 text-sm mt-2">Preparing fighters</p>
    </div>
  )
}

export function GameScene({ playerFaceUrl }) {
  const combat = useCombat()
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [countdownDone, setCountdownDone] = useState(false)

  const handleLoaded = useCallback(() => setAssetsLoaded(true), [])
  const handleCountdownComplete = useCallback(() => setCountdownDone(true), [])

  const showLoading = !assetsLoaded
  const showCountdown = assetsLoaded && !countdownDone
  const gameReady = assetsLoaded && countdownDone

  return (
    <div className="relative h-screen w-screen">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <LoadingTracker onLoaded={handleLoaded} />
          <Scene combat={combat} playerFaceUrl={playerFaceUrl} />
        </Suspense>
      </Canvas>

      {/* Loading overlay while GLBs load */}
      {showLoading && <LoadingOverlay />}

      {/* Countdown overlay after assets loaded */}
      {showCountdown && <CountdownOverlay onComplete={handleCountdownComplete} />}

      {/* HUD only visible once game is ready */}
      {gameReady && (
        <HUD
          playerHp={combat.playerHp}
          opponentHp={combat.opponentHp}
          playerSkill={combat.playerSkill}
          opponentSkill={combat.opponentSkill}
        />
      )}
    </div>
  )
}
