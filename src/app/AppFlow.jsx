import { Routes, Route, useNavigate } from 'react-router-dom'
import { GameScene } from '../game/GameScene'
import LandingPage from '../room/LandingPage'
import LobbyPage from '../room/LobbyPage'
import CreateRoom from '../room/CreateRoom'
import JoinRoom from '../room/JoinRoom'
import Countdown from '../room/Countdown'

export default function AppFlow() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/" element={<LandingPage onStart={() => navigate('/start')} />} />
      <Route
        path="/start"
        element={
          <LobbyPage
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
            onGameStart={() => navigate('/countdown')}
            onBack={() => navigate('/start')}
          />
        }
      />
      <Route
        path="/join"
        element={
          <JoinRoom
            onJoined={() => navigate('/countdown')}
            onBack={() => navigate('/start')}
          />
        }
      />
      <Route path="/countdown" element={<Countdown onComplete={() => navigate('/game')} />} />
      <Route path="/game" element={<GameScene />} />
    </Routes>
  )
}
