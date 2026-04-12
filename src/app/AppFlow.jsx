import { useCallback, useRef, useState } from 'react'
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { setRoomCalibration, setRoomCharacter, setRoomArena } from '../api/client'
import { GameScene } from '../game/GameScene'
import { CHARACTER_KEY_TO_ID } from '../game/constants/game'
import { useWebcam } from '../game/hooks/useWebcam'
import { usePoseDetection } from '../game/hooks/usePoseDetection'
import LandingPage from '../room/LandingPage'
import LobbyPage from '../room/LobbyPage'
import CreateRoom from '../room/CreateRoom'
import JoinRoom from '../room/JoinRoom'
import CharacterSelect from '../room/CharacterSelect'
import ArenaSelect from '../room/ArenaSelect'
import CalibrationPage from '../room/CalibrationPage'

/**
 * Route guard — redirects to fallback if condition is falsy.
 */
function Guard({ ok, fallback = '/', children }) {
  if (!ok) return <Navigate to={fallback} replace />
  return children
}

export default function AppFlow() {
  const [playerName, setPlayerName] = useState('')
  const [playerFaceUrl, setPlayerFaceUrl] = useState(null)
  const [playerFaceId, setPlayerFaceId] = useState(null)
  const [userId, setUserId] = useState(null)
  const [opponentFaceUrl, setOpponentFaceUrl] = useState(null)
  const [roomCode, setRoomCode] = useState(null)
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [selectedArena, setSelectedArena] = useState('arena')
  const [isOwner, setIsOwner] = useState(false)
  const [calibrationReady, setCalibrationReady] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const cvActionHandlerRef = useRef(null)
  const cvEnabled = location.pathname === '/calibration' || location.pathname === '/game'

  const handleCvAction = useCallback((action) => {
    cvActionHandlerRef.current?.(action)
  }, [])

  const setCvActionHandler = useCallback((handler) => {
    cvActionHandlerRef.current = handler
  }, [])

  const webcam = useWebcam(cvEnabled)
  const poseDet = usePoseDetection(webcam.videoRef, cvEnabled, handleCvAction)
  const cv = {
    status: poseDet.status,
    lastAction: poseDet.lastAction,
    stream: webcam.stream,
    attachDisplayCanvasRef: poseDet.attachOverlayCanvasRef,
    send: (msg) => { if (msg.type === 'recalibrate') poseDet.recalibrate() },
    gameReady: poseDet.gameReady,
    recalibrate: poseDet.recalibrate,
  }

  function handleFaceUploaded(faceId, faceUrl) {
    setPlayerFaceId(faceId)
    setPlayerFaceUrl(faceUrl)
  }

  // Called by CreateRoom (room owner)
  function handleOwnerRoomReady(code) {
    setIsOwner(true)
    setRoomCode(code)
    navigate('/arena')
  }

  // Called by JoinRoom (guest)
  function handleGuestRoomReady(code) {
    setIsOwner(false)
    setRoomCode(code)
    navigate('/arena')
  }

  // Called by ArenaSelect — owner passes their chosen key; guest passes the key received via polling
  async function handleArenaSelected(arenaKey) {
    if (arenaKey) {
      setSelectedArena(arenaKey)
      if (isOwner && roomCode) {
        await setRoomArena(roomCode, userId, arenaKey)
      }
    }
    navigate('/select')
  }

  async function handleCharacterConfirmed(characterKey) {
    const characterId = CHARACTER_KEY_TO_ID[characterKey]
    if (!roomCode || !userId || !characterId) {
      throw new Error('Room or character selection is missing')
    }
    console.log('[AppFlow] confirming character', { roomCode, userId, characterKey, characterId })
    const result = await setRoomCharacter(roomCode, userId, characterId)
    setSelectedCharacter(characterKey)
    setCalibrationReady(false)
    return result
  }

  function handleBothCharactersSelected() {
    navigate('/calibration')
  }

  async function handleCalibrationReady() {
    if (!roomCode || !userId) {
      throw new Error('Room or user is missing')
    }
    const result = await setRoomCalibration(roomCode, userId, true)
    if (result?.both_calibrated) {
      setCalibrationReady(true)
    }
    return result
  }

  function handleBothCalibrated() {
    setCalibrationReady(true)
    navigate('/game')
  }

  return (
    <>
    <video ref={webcam.attachVideoRef} playsInline muted style={{ display: 'none' }} />
    <Routes>
      <Route path="/" element={<LandingPage onStart={() => navigate('/start')} />} />

      {/* /start — anyone can access */}
      <Route
        path="/start"
        element={
          <LobbyPage
            playerName={playerName}
            setPlayerName={setPlayerName}
            playerFaceUrl={playerFaceUrl}
            playerFaceId={playerFaceId}
            onFaceUploaded={handleFaceUploaded}
            onUserRegistered={setUserId}
            onCreateGame={() => navigate('/create')}
            onJoinGame={() => navigate('/join')}
            onBack={() => navigate('/')}
          />
        }
      />

      {/* /create — must have userId (registered) */}
      <Route
        path="/create"
        element={
          <Guard ok={userId} fallback="/start">
            <CreateRoom
              userId={userId}
              playerFaceUrl={playerFaceUrl}
              onOpponentFaceUrl={setOpponentFaceUrl}
              onGameStart={handleOwnerRoomReady}
              onBack={() => navigate('/start')}
            />
          </Guard>
        }
      />

      {/* /join — must have userId */}
      <Route
        path="/join"
        element={
          <Guard ok={userId} fallback="/start">
            <JoinRoom
              userId={userId}
              playerFaceUrl={playerFaceUrl}
              onOpponentFaceUrl={setOpponentFaceUrl}
              onJoined={handleGuestRoomReady}
              onBack={() => navigate('/start')}
            />
          </Guard>
        }
      />

      {/* /arena — must have roomCode */}
      <Route
        path="/arena"
        element={
          <Guard ok={roomCode} fallback="/start">
            <ArenaSelect
              isOwner={isOwner}
              roomCode={roomCode}
              onArenaSelected={handleArenaSelected}
            />
          </Guard>
        }
      />

      {/* /select — must have roomCode (room confirmed) */}
      <Route
        path="/select"
        element={
          <Guard ok={roomCode} fallback="/start">
            <CharacterSelect
              roomCode={roomCode}
              userId={userId}
              playerFaceUrl={playerFaceUrl}
              onConfirm={handleCharacterConfirmed}
              onBothSelected={handleBothCharactersSelected}
            />
          </Guard>
        }
      />

      <Route
        path="/calibration"
        element={
          <Guard ok={roomCode && selectedCharacter} fallback="/start">
            <CalibrationPage
              roomCode={roomCode}
              userId={userId}
              playerName={playerName}
              playerFaceUrl={playerFaceUrl}
              cvBridge={cv}
              onReady={handleCalibrationReady}
              onBothReady={handleBothCalibrated}
            />
          </Guard>
        }
      />

      {/* /game — must have roomCode + character selected */}
      <Route
        path="/game"
        element={
          <Guard ok={roomCode && selectedCharacter && calibrationReady} fallback="/start">
            <GameScene
              roomCode={roomCode}
              userId={userId}
              playerName={playerName}
              playerFaceUrl={playerFaceUrl}
              opponentFaceUrl={opponentFaceUrl}
              playerCharacterKey={selectedCharacter || 'blue'}
              arenaKey={selectedArena}
              cvBridge={cv}
              setCvActionHandler={setCvActionHandler}
            />
          </Guard>
        }
      />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
