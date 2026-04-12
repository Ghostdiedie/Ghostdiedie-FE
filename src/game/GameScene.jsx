import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { createWebSocket } from '../api/client'
import { useWebRTC } from './hooks/useWebRTC'
import { useLocalCVBridge } from './hooks/useLocalCVBridge'
import { Arena } from './components/Arena'
import { PlayerCharacter } from './components/PlayerCharacter'
import { OpponentCharacter } from './components/OpponentCharacter'
import { FollowCamera } from './components/FollowCamera'
import { HUD } from './components/HUD'
import { useCVControls } from './hooks/useCVControls'
import { usePlayerMovement } from './hooks/usePlayerMovement'
import { useMultiplayer } from './hooks/useMultiplayer'
import { ARENA_RADIUS, ARENA_BOUNDARY_MARGIN, FIGHTER_MIN_DISTANCE, SEPARATION_MAX_PUSH, CHARACTER_MODEL_PATHS, CHARACTER_ID_TO_KEY } from './constants/game'

// Preload all character models so useGLTF never suspends when the opponent's character key changes
Object.values(CHARACTER_MODEL_PATHS).forEach(path => useGLTF.preload(path))

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
    const player = playerPosRef.current
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
    player[0] -= nx * push * 2
    player[2] -= nz * push * 2
    clampToArena(player)
  })
  return null
}

const COUNTDOWN_SEQUENCE = [5, 4, 3, 2, 1, 'FIGHT!']
const COUNTDOWN_STEP_MS = 1000
const FIGHT_STEP_MS = 1400
const COUNTDOWN_TOTAL_MS = (COUNTDOWN_SEQUENCE.length - 1) * COUNTDOWN_STEP_MS + FIGHT_STEP_MS

function RoundWinOverlay({ roundNumber, winnerName, isMe, roundWins, playerIndex }) {
  const myWins = roundWins[playerIndex] ?? 0
  const oppWins = roundWins[1 - playerIndex] ?? 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 select-none animate-fade-in">
      <div className="flex flex-col items-center gap-3">
        <span className="text-white/35 font-bold tracking-[0.35em] text-[11px] uppercase">Round {roundNumber} Complete</span>
        <span
          className={[
            'font-black leading-none text-[clamp(3.5rem,11vw,7rem)] drop-shadow-[0_0_40px_rgba(0,0,0,0.8)]',
            isMe ? 'text-green-400' : 'text-red-400',
          ].join(' ')}
        >
          {winnerName}
        </span>
        <span className="font-black tracking-[0.18em] text-white/70 text-[clamp(1.2rem,3.5vw,2.2rem)] -mt-1 uppercase">
          Wins Round {roundNumber}
        </span>
        {/* Round win dots */}
        <div className="flex items-center gap-6 mt-3">
          <div className="flex gap-2">
            {[0, 1].map(i => (
              <span key={i} className={`w-3.5 h-3.5 rounded-full border ${i < myWins ? 'bg-green-400 border-green-400' : 'bg-transparent border-white/30'}`} />
            ))}
          </div>
          <span className="text-white/20 font-bold text-sm">VS</span>
          <div className="flex gap-2">
            {[0, 1].map(i => (
              <span key={i} className={`w-3.5 h-3.5 rounded-full border ${i < oppWins ? 'bg-red-400 border-red-400' : 'bg-transparent border-white/30'}`} />
            ))}
          </div>
        </div>
        <p className="text-white/25 text-xs mt-3 tracking-widest uppercase">Next round starting soon…</p>
      </div>
    </div>
  )
}

function GameEndOverlay({ winnerName, isMe, onBack }) {
  return (
    <div className="fixed inset-0 z-60 flex flex-col items-center justify-center bg-black/90 select-none">
      <div className="flex flex-col items-center gap-4">
        <span className="text-white/35 font-bold tracking-[0.35em] text-[11px] uppercase">Match Over</span>
        <span
          className={[
            'font-black leading-none text-[clamp(3.5rem,11vw,7rem)] drop-shadow-[0_0_40px_rgba(0,0,0,0.8)]',
            isMe ? 'text-green-400' : 'text-red-400',
          ].join(' ')}
        >
          {winnerName}
        </span>
        <span className="font-black tracking-[0.18em] text-white/70 text-[clamp(1.2rem,3.5vw,2rem)] -mt-1 uppercase">
          Wins the Match!
        </span>
        <button
          onClick={onBack}
          className="mt-10 px-10 py-3.5 bg-white text-gray-900 font-bold text-base rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors pointer-events-auto"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  )
}

function SceneReadySignal({ onReady }) {
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true
    onReady()
  }, [onReady])

  return null
}

function CountdownOverlay({ countdownStartMs, serverClockOffsetMs, onComplete, roundNumber = 1 }) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!countdownStartMs) return

    let rafId = 0
    let timeoutId = 0
    const completeAtMs = countdownStartMs + COUNTDOWN_TOTAL_MS
    const syncedNow = () => Date.now() + serverClockOffsetMs

    const tick = () => {
      const nextNow = syncedNow()
      setNowMs(nextNow)
      if (nextNow >= completeAtMs) {
        onComplete()
        return
      }
      rafId = window.requestAnimationFrame(tick)
    }

    const delayMs = Math.max(0, countdownStartMs - syncedNow())
    timeoutId = window.setTimeout(() => {
      tick()
    }, Math.min(delayMs, 250))

    return () => {
      window.clearTimeout(timeoutId)
      window.cancelAnimationFrame(rafId)
    }
  }, [countdownStartMs, onComplete, serverClockOffsetMs])

  if (!countdownStartMs) return null

  const elapsedMs = Math.max(0, nowMs - countdownStartMs)
  const completeAtMs = countdownStartMs + COUNTDOWN_TOTAL_MS
  if (nowMs >= completeAtMs) return null

  const step = elapsedMs >= (COUNTDOWN_SEQUENCE.length - 1) * COUNTDOWN_STEP_MS
    ? COUNTDOWN_SEQUENCE.length - 1
    : Math.floor(elapsedMs / COUNTDOWN_STEP_MS)
  const current = COUNTDOWN_SEQUENCE[step]
  const isFight = current === 'FIGHT!'
  const stepElapsedMs = isFight
    ? elapsedMs - (COUNTDOWN_SEQUENCE.length - 1) * COUNTDOWN_STEP_MS
    : elapsedMs - step * COUNTDOWN_STEP_MS
  const showFor = isFight ? 900 : 650
  const visible = stepElapsedMs < showFor

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none select-none">
      <div className="absolute inset-0 bg-black/60 transition-opacity duration-500" style={{ opacity: Math.max(0, 1 - step * 0.15) }} />
      {roundNumber > 1 && (
        <div className="relative z-10 mb-2">
          <span className="font-black tracking-[0.3em] text-white/50 text-[clamp(1.2rem,3vw,2rem)] uppercase">Round {roundNumber}</span>
        </div>
      )}
      <div className={['relative z-10 transition-[opacity,transform] duration-220 ease-out', visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.3]'].join(' ')}>
        {isFight
          ? <span className="font-black tracking-[0.05em] text-red-500 text-[clamp(4rem,12vw,7rem)] drop-shadow-[0_0_40px_rgba(239,68,68,0.5)]">FIGHT!</span>
          : <span className="font-black text-white text-[clamp(10rem,28vw,18rem)] leading-none drop-shadow-[0_0_60px_rgba(255,255,255,0.3)]">{current}</span>
        }
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

export function GameScene({ roomCode, playerName, playerFaceUrl, opponentFaceUrl, playerCharacterKey = 'blue' }) {
  const navigate = useNavigate()
  const [ws, setWs] = useState(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [playerIndex, setPlayerIndex] = useState(0)
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [countdownDone, setCountdownDone] = useState(false)
  const [countdownStartMs, setCountdownStartMs] = useState(null)
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0)
  const [hudBindings, setHudBindings] = useState(null)
  const [resolvedOpponentFaceUrl, setResolvedOpponentFaceUrl] = useState(() => opponentFaceUrl ?? null)
  const [opponentName, setOpponentName] = useState('')
  const [roundNumber, setRoundNumber] = useState(1)
  const [roundWins, setRoundWins] = useState([0, 0]) // [player0Wins, player1Wins]
  const [roundEndInfo, setRoundEndInfo] = useState(null) // { roundNumber, winnerName, winnerIndex, roundWins, isGameOver }
  const [gameEndInfo, setGameEndInfo] = useState(null)   // { winnerName, winnerIndex }

  const cvControls = useCVControls()
  const cvBridge = useLocalCVBridge(cvControls.handleAction)
  const cvMode = true

  useWebRTC(ws, cvBridge.stream, playerIndex === 0, gameStarted)

  const handleLoaded = useCallback(() => setAssetsLoaded(true), [])
  const handleCountdownComplete = useCallback(() => setCountdownDone(true), [])

  // Connect WebSocket on mount — use addEventListener so useMultiplayer can also listen
  useEffect(() => {
    if (!roomCode) return

    const socket = createWebSocket(roomCode)

    socket.addEventListener('open', () => {
      console.log('[GameScene] ws open', { roomCode })
      setWs(socket)
    })

    // Listen for game_start to update local state
    function onMsg(e) {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.type === 'afk_timeout') {
        console.log('[GameScene] afk_timeout — returning to lobby', msg)
        socket.close()
        navigate('/')
        return
      }
      if (msg.type === 'game_start') {
        const clientNowMs = Date.now()
        const nextServerClockOffsetMs = (msg.server_now_ms ?? clientNowMs) - clientNowMs
        console.log('[GameScene] game_start received', {
          roomCode,
          playerIndex: msg.player_index,
          serverNowMs: msg.server_now_ms,
          countdownStartMs: msg.countdown_start_ms,
          meCharacterId: msg.me?.character_id,
          opponentCharacterId: msg.opponent?.character_id,
          opponentHasFace: Boolean(msg.opponent?.profile_image_url),
        })
        setPlayerIndex(msg.player_index ?? 0)
        setServerClockOffsetMs(nextServerClockOffsetMs)
        setCountdownStartMs(msg.countdown_start_ms ?? (clientNowMs + 1500))
        setCountdownDone(false)
        setRoundNumber(1)
        setRoundWins([0, 0])
        if (msg.opponent?.profile_image_url) {
          setResolvedOpponentFaceUrl(msg.opponent.profile_image_url)
        }
        if (msg.opponent?.name) {
          setOpponentName(msg.opponent.name)
        }
        setGameStarted(true)
      }
      if (msg.type === 'round_end') {
        console.log('[GameScene] round_end received', msg)
        setRoundEndInfo({
          roundNumber: msg.round_number,
          winnerName: msg.winner_name,
          winnerIndex: msg.winner_index,
          roundWins: msg.round_wins ?? [0, 0],
          isGameOver: msg.game_over ?? false,
        })
      }
      if (msg.type === 'round_start') {
        const clientNowMs = Date.now()
        const nextServerClockOffsetMs = (msg.server_now_ms ?? clientNowMs) - clientNowMs
        console.log('[GameScene] round_start received', {
          roundNumber: msg.round_number,
          roundWins: msg.round_wins,
          countdownStartMs: msg.countdown_start_ms,
        })
        setServerClockOffsetMs(nextServerClockOffsetMs)
        setCountdownStartMs(msg.countdown_start_ms ?? (clientNowMs + 2000))
        setCountdownDone(false)
        setRoundNumber(msg.round_number ?? 2)
        setRoundWins(msg.round_wins ?? [0, 0])
        setRoundEndInfo(null)
      }
      if (msg.type === 'game_end') {
        console.log('[GameScene] game_end received', msg)
        setRoundEndInfo(null)
        setGameEndInfo({
          winnerName: msg.winner_name,
          winnerIndex: msg.winner_index ?? -1,
        })
      }
    }
    socket.addEventListener('message', onMsg)

    socket.addEventListener('error', () => {
      console.error('[GameScene] WebSocket connection failed', { roomCode })
    })

    return () => {
      socket.removeEventListener('message', onMsg)
      socket.close()
      console.log('[GameScene] ws closed', { roomCode })
    }
  }, [roomCode, navigate])

  const showLoading = !assetsLoaded
  const showWaiting = assetsLoaded && !gameStarted
  const showRoundEnd = !!roundEndInfo && !gameEndInfo
  const showCountdown = assetsLoaded && gameStarted && !countdownDone && !roundEndInfo && !gameEndInfo
  const gameReady = assetsLoaded && gameStarted && countdownDone

  return (
    <div className="relative h-screen w-screen">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, alpha: false }} performance={{ min: 0.5 }}>
        <Suspense fallback={null}>
          <SceneReadySignal onReady={handleLoaded} />
          {ws && (
            <SceneWithMultiplayer
              ws={ws}
              playerFaceUrl={playerFaceUrl}
              opponentFaceUrl={resolvedOpponentFaceUrl}
              playerCharacterKey={playerCharacterKey}
              onHudBindings={setHudBindings}
              controls={cvControls}
              playerResult={gameEndInfo ? (gameEndInfo.winnerIndex === playerIndex ? 'win' : 'lose') : null}
              opponentResult={gameEndInfo ? (gameEndInfo.winnerIndex === playerIndex ? 'lose' : 'win') : null}
              fightReady={countdownDone && !roundEndInfo && !gameEndInfo}
            />
          )}
        </Suspense>
      </Canvas>

      {showLoading && <LoadingOverlay />}
      {showWaiting && <WaitingForOpponentOverlay />}
      {showCountdown && (
        <CountdownOverlay
          countdownStartMs={countdownStartMs}
          serverClockOffsetMs={serverClockOffsetMs}
          onComplete={handleCountdownComplete}
          roundNumber={roundNumber}
        />
      )}

      {showRoundEnd && roundEndInfo && (
        <RoundWinOverlay
          roundNumber={roundEndInfo.roundNumber}
          winnerName={roundEndInfo.winnerName}
          isMe={roundEndInfo.winnerIndex === playerIndex}
          roundWins={roundEndInfo.roundWins}
          playerIndex={playerIndex}
        />
      )}

      {gameEndInfo && (
        <GameEndOverlay
          winnerName={gameEndInfo.winnerName}
          isMe={gameEndInfo.winnerIndex === playerIndex}
          onBack={() => navigate('/')}
        />
      )}

      {gameReady && hudBindings && (
        <HUD
          playerHp={hudBindings.playerHp}
          opponentHp={hudBindings.opponentHp}
          playerMaxHp={hudBindings.playerMaxHp}
          opponentMaxHp={hudBindings.opponentMaxHp}
          playerSkill={hudBindings.playerGauge}
          opponentSkill={hudBindings.opponentGauge}
          playerName={playerName}
          opponentName={opponentName}
          playerFaceUrl={playerFaceUrl}
          opponentFaceUrl={resolvedOpponentFaceUrl}
          localCvCanvasAttachRef={cvBridge.attachDisplayCanvasRef}
          cvMode={cvMode}
          cvStatus={cvBridge.status}
          cvLastDetected={cvBridge.lastAction}
          roundNumber={roundNumber}
          playerRoundWins={roundWins[playerIndex]}
          opponentRoundWins={roundWins[1 - playerIndex]}
        />
      )}
    </div>
  )
}

function SceneWithMultiplayer({ ws, playerFaceUrl, opponentFaceUrl, playerCharacterKey, onHudBindings, controls, playerResult = null, opponentResult = null, fightReady = false }) {
  // Opponent position ref shared between usePlayerMovement and useMultiplayer
  const opponentPosRef = useRef([0, 0, -5])

  const movement = usePlayerMovement(controls.keys, opponentPosRef)
  const mp = useMultiplayer(ws, movement)

  // Track opponent character key as proper React state so model loads immediately
  // (reading mp.opponentCharacterKey.current in JSX can cause a stale-ref mid-game surprise)
  const [opponentCharKey, setOpponentCharKey] = useState('red')
  useEffect(() => {
    if (!ws) return
    function onMsg(e) {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.type === 'game_start' && msg.opponent?.character_id) {
        setOpponentCharKey(CHARACTER_ID_TO_KEY[msg.opponent.character_id] || 'red')
      }
      if (msg.type === 'character_select' && msg.characterKey) {
        setOpponentCharKey(msg.characterKey)
      }
    }
    ws.addEventListener('message', onMsg)
    return () => ws.removeEventListener('message', onMsg)
  }, [ws])

  // Send our character selection to opponent on first connect
  const sentCharRef = useRef(false)
  useEffect(() => {
    if (ws && !sentCharRef.current && playerCharacterKey) {
      mp.sendCharacterSelect(playerCharacterKey)
      sentCharRef.current = true
    }
  }, [ws, playerCharacterKey, mp])

  // Sync: copy multiplayer opponent position into the shared ref every frame
  useFrame(() => {
    const src = mp.opponent.position.current
    const dst = opponentPosRef.current
    dst[0] = src[0]
    dst[1] = src[1]
    dst[2] = src[2]
  })

  useEffect(() => {
    onHudBindings({
      playerHp: mp.playerHp,
      opponentHp: mp.opponentHp,
      playerMaxHp: mp.playerMaxHp,
      opponentMaxHp: mp.opponentMaxHp,
      playerGauge: mp.playerGauge,
      opponentGauge: mp.opponentGauge,
    })
  }, [mp.opponentGauge, mp.opponentHp, mp.opponentMaxHp, mp.playerGauge, mp.playerHp, mp.playerMaxHp, onHudBindings])

  // Combat inputs — blocked during countdown and round transitions
  useFrame(() => {
    if (!fightReady) return
    const events = controls.consumeCombatEvents()
    if (events.punchLeft) mp.playerPunch('left')
    if (events.kick) mp.playerKick()
    if (events.punchRight) mp.playerPunch('right')
    if (events.headAttack) mp.playerHeadAttack()
  })

  return (
    <>
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
        gameResult={playerResult}
      />

      <OpponentCharacter
        opponentAI={mp.opponent}
        fighterState={mp.opponentState}
        playerPos={movement.position}
        faceImageUrl={opponentFaceUrl}
        characterKey={opponentCharKey}
        gameResult={opponentResult}
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
