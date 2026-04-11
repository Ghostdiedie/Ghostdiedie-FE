import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { GameScene } from '../game/GameScene'
import LandingPage from '../room/LandingPage'
import LobbyPage from '../room/LobbyPage'
import CreateRoom from '../room/CreateRoom'
import JoinRoom from '../room/JoinRoom'

export default function AppFlow() {
  const [playerName, setPlayerName] = useState('')
  const [playerFaceUrl, setPlayerFaceUrl] = useState(null)
  const [playerFaceId, setPlayerFaceId] = useState(null)
  const [userId, setUserId] = useState(null)
  const navigate = useNavigate()

  function handleFaceUploaded(faceId, faceUrl) {
    setPlayerFaceId(faceId)
    setPlayerFaceUrl(faceUrl)
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage onStart={() => navigate('/start')} />} />
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
      <Route
        path="/create"
        element={
          <CreateRoom
            userId={userId}
            playerName={playerName}
            playerFaceUrl={playerFaceUrl}
            playerFaceId={playerFaceId}
            onFaceUploaded={handleFaceUploaded}
            onGameStart={() => navigate('/game')}
            onBack={() => navigate('/start')}
          />
        }
      />
      <Route
        path="/join"
        element={
          <JoinRoom
            userId={userId}
            playerName={playerName}
            playerFaceUrl={playerFaceUrl}
            playerFaceId={playerFaceId}
            onFaceUploaded={handleFaceUploaded}
            onJoined={() => navigate('/game')}
            onBack={() => navigate('/start')}
          />
        }
      />
      <Route path="/game" element={<GameScene playerFaceUrl={playerFaceUrl} />} />
    </Routes>
  )
}
