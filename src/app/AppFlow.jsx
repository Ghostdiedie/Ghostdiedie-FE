import { useCallback, useState } from 'react'
import { GameScene } from '../game/GameScene'
import LandingPage from '../room/LandingPage'
import LobbyPage from '../room/LobbyPage'
import CreateRoom from '../room/CreateRoom'
import JoinRoom from '../room/JoinRoom'
import Countdown from '../room/Countdown'

export default function AppFlow() {
  const [page, setPage] = useState('landing')
  const [playerName, setPlayerName] = useState('')
  const goLobby = useCallback(() => setPage('lobby'), [])
  const goCreate = useCallback(() => setPage('create'), [])
  const goJoin = useCallback(() => setPage('join'), [])
  const goCountdown = useCallback(() => setPage('countdown'), [])
  const goGame = useCallback(() => setPage('game'), [])

  if (page === 'landing') {
    return <LandingPage onStart={goLobby} />
  }

  if (page === 'lobby') {
    return (
      <LobbyPage
        playerName={playerName}
        setPlayerName={setPlayerName}
        onCreateGame={goCreate}
        onJoinGame={goJoin}
      />
    )
  }

  if (page === 'create') {
    return (
      <CreateRoom
        playerName={playerName}
        onGameStart={goCountdown}
        onBack={goLobby}
      />
    )
  }

  if (page === 'join') {
    return (
      <JoinRoom
        playerName={playerName}
        onJoined={goCountdown}
        onBack={goLobby}
      />
    )
  }

  if (page === 'countdown') {
    return <Countdown onComplete={goGame} />
  }

  return <GameScene />
}
