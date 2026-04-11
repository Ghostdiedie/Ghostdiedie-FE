import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { createWebSocket } from '../api/client'
import { useWebcam } from './hooks/useWebcam'
import { useWebRTC } from './hooks/useWebRTC'
import { usePoseDetection } from './hooks/usePoseDetection'
import { Arena } from './components/Arena'
import { PlayerCharacter } from './components/PlayerCharacter'
import { OpponentCharacter } from './components/OpponentCharacter'
import { FollowCamera } from './components/FollowCamera'
import { HUD } from './components/HUD'
import { useKeyboard } from './hooks/useKeyboard'
import { usePlayerMovement } from './hooks/usePlayerMovement'
import { useMultiplayer } from './hooks/useMultiplayer'
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

function CharacterSeparation({ playerPosRef, opponentPosRef }) {
  useFrame(() => {
    const player   = playerPosRef.current
    const opponent = opponentPosRef.current

    let dx = opponent[0] - player[0]
    let dz = opponent[2] - player[2]
    let dist = Math.sqrt(dx * dx + dz * dz)

    if (dist === 0) { dx = 0; dz = 1; dist = 1 }
    if (dist >= FIGHTER_MIN_DISTANCE) return

    const overlap = FIGHTER_MIN_DISTANCE - dist
    const push = Math.min(overlap * 0.5, SEPARATION_MAX_PUSH)
    const nx = dx / dist
    const nz = dz / dist

    // Only push the player (opponent position is from server)
    player[0] -= nx * push * 2
    player[2] -= nz * push * 2

    clampToArena(player)
  })

  return null
}

const COUNTDOWN_SEQUENCE = [5, 4, 3, 2, 1, 'FIGHT!']

function LoadingTracker({ onLoaded }) {
  const { active } = useProgress()
  const calledRef = useRef(false)

  if (!active && !calledRef.current) {
    calledRef.current = true
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
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
      <p className="text-white text-lg font-semibold tracking-wide">Loading Arena...</p>
      <p className="text-white/50 text-sm mt-2">Preparing fighters</p>
    </div>
  )
}

function WaitingForOpponentOverlay() {
  return (
    <div className="fixed inset-0 z-55 flex flex-col items-center justify-center bg-black/70 select-none">
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
      <p className="text-white text-lg font-semibold tracking-wide">Connecting...</p>
      <p className="text-white/50 text-sm mt-2">Waiting for opponent to connect</p>
    </div>
  )
}

export function GameScene({ roomCode, playerFaceUrl, opponentFaceUrl, playerCharacterKey = 'blue' }) {
  const [ws, setWs] = useState(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [playerIndex, setPlayerIndex] = useState(0)
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [countdownDone, setCountdownDone] = useState(false)

  // Multiplayer refs for HUD (need stable refs before Scene mounts)
  const mpRef = useRef(null)

  // CV mode toggle (Tab key)
  const [cvMode, setCvMode] = useState(false)
  useEffect(() => {
    function onKey(e) { if (e.key === 'Tab') { e.preventDefault(); setCvMode(v => !v) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // CV event queue (bridge: usePoseDetection outside Canvas → useFrame inside Canvas)
  const cvEventsRef = useRef({ punchLeft: false, punchRight: false })
  const cvCallbacks = useRef({
    onLeftPunch: () => { cvEventsRef.current.punchLeft = true },
    onRightPunch: () => { cvEventsRef.current.punchRight = true },
  })

  // Webcam + WebRTC
  const { videoRef: webcamVideoRef, streamRef: webcamStreamRef } = useWebcam()
  const { remoteVideoRef } = useWebRTC(ws, webcamStreamRef.current, playerIndex === 0, gameStarted)

  // CV Pose detection
  usePoseDetection(webcamVideoRef, cvMode && countdownDone, cvCallbacks.current)

  const handleLoaded = useCallback(() => setAssetsLoaded(true), [])
  const handleCountdownComplete = useCallback(() => setCountdownDone(true), [])

  // Connect WebSocket on mount
  useEffect(() => {
    if (!roomCode) return

    const socket = createWebSocket(roomCode)

    socket.onopen = () => {
      setWs(socket)
    }

    socket.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.type === 'game_start') {
        setPlayerIndex(msg.player_index ?? 0)
        setGameStarted(true)
      }
    }

    socket.onerror = () => {
      console.error('WebSocket connection failed')
    }

    return () => {
      socket.close()
    }
  }, [roomCode])

  const showLoading = !assetsLoaded
  const showWaiting = assetsLoaded && !gameStarted
  const showCountdown = assetsLoaded && gameStarted && !countdownDone
  const gameReady = assetsLoaded && gameStarted && countdownDone

  return (
    <div className="relative h-screen w-screen">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, alpha: false }} performance={{ min: 0.5 }}>
        <Suspense fallback={null}>
          <LoadingTracker onLoaded={handleLoaded} />
          {ws && <SceneWithMultiplayer ws={ws} playerFaceUrl={playerFaceUrl} opponentFaceUrl={opponentFaceUrl} playerCharacterKey={playerCharacterKey} mpRef={mpRef} cvMode={cvMode} cvEventsRef={cvEventsRef} />}
        </Suspense>
      </Canvas>

      {showLoading && <LoadingOverlay />}
      {showWaiting && <WaitingForOpponentOverlay />}
      {showCountdown && <CountdownOverlay onComplete={handleCountdownComplete} />}

      {gameReady && mpRef.current && (
        <HUD
          playerHp={mpRef.current.playerHp}
          opponentHp={mpRef.current.opponentHp}
          playerSkill={mpRef.current.playerGauge}
          opponentSkill={mpRef.current.opponentGauge}
          playerFaceUrl={playerFaceUrl}
          opponentFaceUrl={opponentFaceUrl}
          webcamVideoRef={webcamVideoRef}
          remoteVideoRef={remoteVideoRef}
          cvMode={cvMode}
        />
      )}
    </div>
  )
}

/**
 * Wrapper that creates multiplayer hook inside Canvas context and exposes refs.
 */
function SceneWithMultiplayer({ ws, playerFaceUrl, opponentFaceUrl, playerCharacterKey, mpRef, cvMode, cvEventsRef }) {
  const { keys, consumeCombatEvents } = useKeyboard()

  // Placeholder opponent position for initial movement hook
  const tempOpponentPos = useRef([0, 0, -5])

  // We need to create movement first, then multiplayer, then patch opponent pos
  const movement = usePlayerMovement(keys, tempOpponentPos)
  const mp = useMultiplayer(ws, movement)

  // Patch: use real opponent position for player facing
  tempOpponentPos.current = mp.opponent.position.current

  // Expose mp refs to parent for HUD
  useEffect(() => {
    mpRef.current = mp
  }, [mp, mpRef])

  // Process combat inputs each frame (keyboard or CV)
  useFrame(() => {
    if (cvMode) {
      // CV mode: read events from pose detection
      const cv = cvEventsRef.current
      if (cv.punchLeft) { mp.playerPunch('left'); cv.punchLeft = false }
      if (cv.punchRight) { mp.playerPunch('right'); cv.punchRight = false }
    } else {
      // Keyboard mode
      const events = consumeCombatEvents()
      if (events.punchLeft) mp.playerPunch('left')
      if (events.kick) mp.playerKick()
      if (events.punchRight) mp.playerPunch('right')
    }
  })

  return (
    <>
      {/* Optimized lighting: ambient + 1 shadow directional + 2 fill points */}
      <ambientLight intensity={0.7} color="#c8b888" />
      <directionalLight
        position={[2, 8, 4]}
        intensity={2.5}
        color="#fff4d0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <pointLight position={[-6, 6, -4]} intensity={20} color="#ffe8a0" distance={25} decay={2} />
      <pointLight position={[6, 6, 4]} intensity={20} color="#ffe8a0" distance={25} decay={2} />
      <fog attach="fog" args={['#1a1612', 38, 70]} />
      <color attach="background" args={['#161410']} />

      <Arena />

      <PlayerCharacter
        movement={movement}
        fighterState={mp.playerState}
        opponentPos={mp.opponent.position}
        faceImageUrl={playerFaceUrl}
        characterKey={playerCharacterKey}
      />

      <OpponentCharacter
        opponentAI={mp.opponent}
        fighterState={mp.opponentState}
        playerPos={movement.position}
        faceImageUrl={opponentFaceUrl}
        characterKey={mp.opponentCharacterKey?.current || 'red'}
      />

      <CharacterSeparation
        playerPosRef={movement.position}
        opponentPosRef={mp.opponent.position}
      />

      <FollowCamera
        targetPosition={movement.position}
        playerFacing={movement.facing}
        opponentPosition={mp.opponent.position}
      />
    </>
  )
}
