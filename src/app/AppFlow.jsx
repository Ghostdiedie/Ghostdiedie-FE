import { useState } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { setRoomCharacter } from '../api/client'
import { GameScene } from '../game/GameScene'
import { CHARACTER_KEY_TO_ID } from '../game/constants/game'
import LandingPage from '../room/LandingPage'
import LobbyPage from '../room/LobbyPage'
import CreateRoom from '../room/CreateRoom'
import JoinRoom from '../room/JoinRoom'
import CharacterSelect from '../room/CharacterSelect'

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
  const navigate = useNavigate()

  function handleFaceUploaded(faceId, faceUrl) {
    setPlayerFaceId(faceId)
    setPlayerFaceUrl(faceUrl)
  }

  function handleRoomReady(code) {
    setRoomCode(code)
    navigate('/select')
  }

  async function handleCharacterConfirmed(characterKey) {
    const characterId = CHARACTER_KEY_TO_ID[characterKey]
    if (!roomCode || !userId || !characterId) {
      throw new Error('Room or character selection is missing')
    }
    console.log('[AppFlow] confirming character', { roomCode, userId, characterKey, characterId })
    await setRoomCharacter(roomCode, userId, characterId)
    setSelectedCharacter(characterKey)
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
              onGameStart={handleRoomReady}
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
              onJoined={handleRoomReady}
              onBack={() => navigate('/start')}
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
              playerFaceUrl={playerFaceUrl}
              onConfirm={handleCharacterConfirmed}
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
              playerFaceUrl={playerFaceUrl}
              opponentFaceUrl={opponentFaceUrl}
              playerCharacterKey={selectedCharacter || 'blue'}
            />
          </Guard>
        }
      />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
