import { useState } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { setRoomCharacter, setRoomArena } from '../api/client'
import { GameScene } from '../game/GameScene'
import { CHARACTER_KEY_TO_ID } from '../game/constants/game'
import LandingPage from '../room/LandingPage'
import LobbyPage from '../room/LobbyPage'
import CreateRoom from '../room/CreateRoom'
import JoinRoom from '../room/JoinRoom'
import CharacterSelect from '../room/CharacterSelect'
import ArenaSelect from '../room/ArenaSelect'

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
  const navigate = useNavigate()

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
      // Owner: persist arena to backend so guest can poll it
      if (isOwner && roomCode) {
        try { await setRoomArena(roomCode, userId, arenaKey) } catch {}
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
    return result
  }

  function handleBothCharactersSelected() {
    navigate('/game')
  }

  return (
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
              playerName={playerName}
              playerFaceUrl={playerFaceUrl}
              playerFaceId={playerFaceId}
              onFaceUploaded={handleFaceUploaded}
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
              playerName={playerName}
              playerFaceUrl={playerFaceUrl}
              playerFaceId={playerFaceId}
              onFaceUploaded={handleFaceUploaded}
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
              onBack={() => navigate(-1)}
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
              playerFaceUrl={playerFaceUrl}
              onConfirm={handleCharacterConfirmed}
              onBothSelected={handleBothCharactersSelected}
              onBack={() => navigate('/start')}
            />
          </Guard>
        }
      />

      {/* /game — must have roomCode + character selected */}
      <Route
        path="/game"
        element={
          <Guard ok={roomCode && selectedCharacter} fallback="/start">
            <GameScene
              roomCode={roomCode}
              userId={userId}
              playerName={playerName}
              playerFaceUrl={playerFaceUrl}
              opponentFaceUrl={opponentFaceUrl}
              playerCharacterKey={selectedCharacter || 'blue'}
              arenaKey={selectedArena}
            />
          </Guard>
        }
      />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
