import { useState } from 'react'
import { GameScene } from './game/GameScene'
import LandingPage from './room/LandingPage'
import LobbyPage from './room/LobbyPage'
import CreateRoom from './room/CreateRoom'
import JoinRoom from './room/JoinRoom'
import Countdown from './room/Countdown'

function App() {
  const [page, setPage] = useState('landing')
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState(null)

  if (page === 'landing') {
    return <LandingPage onStart={() => setPage('lobby')} />
  }

  if (page === 'lobby') {
    return (
      <LobbyPage
        playerName={playerName}
        setPlayerName={setPlayerName}
        onCreateGame={() => setPage('create')}
        onJoinGame={() => setPage('join')}
      />
    )
  }

  if (page === 'create') {
    return (
      <CreateRoom
        playerName={playerName}
        onGameStart={(code) => {
          setRoomCode(code)
          setPage('countdown')
        }}
        onBack={() => setPage('lobby')}
      />
    )
  }

  if (page === 'join') {
    return (
      <JoinRoom
        playerName={playerName}
        onJoined={(code) => {
          setRoomCode(code)
          setPage('countdown')
        }}
        onBack={() => setPage('lobby')}
      />
    )
  }

  if (page === 'countdown') {
    return <Countdown onComplete={() => setPage('game')} />
  }

  return <GameScene />
}

export default App
