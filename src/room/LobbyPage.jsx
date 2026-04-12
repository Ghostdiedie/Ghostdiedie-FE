import { useState } from 'react'
import { registerUser } from '../api/client'
import Button from '../components/Button'
import FaceUpload from '../components/FaceUpload'
import backgroundImg from '../assets/background/background.webp'
import logoImg from '../assets/background/logo.webp'

export default function LobbyPage({
  playerName, setPlayerName,
  playerFaceUrl, playerFaceId, onFaceUploaded,
  onUserRegistered, onCreateGame, onJoinGame, onBack,
}) {
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')

  const ready = playerName.trim().length > 0 && !!playerFaceId

  async function handleAction(navigateFn) {
    if (!ready) return
    setRegistering(true)
    setError('')
    try {
      const data = await registerUser(playerName.trim(), playerFaceId)
      onUserRegistered(data.user_id)
      navigateFn()
    } catch (err) {
      setError(err.message)
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden select-none"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-150 text-sm font-medium tracking-wide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="relative z-10 flex items-center gap-12 px-8 max-w-[1040px] w-full">
        <div className="animate-slide-to-left shrink-0 flex-1 flex justify-center">
          <img
            src={logoImg}
            alt="Ghost Die Die"
            className="w-[clamp(260px,34vw,500px)] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
          />
        </div>

        <div className="animate-fade-in-right flex-1 flex justify-center">
          <div className="flex flex-col items-center bg-black/60 backdrop-blur-xl border border-white/20 rounded-[28px] px-10 py-10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] w-[360px]">

            <div className="w-full mb-5">
              <FaceUpload faceUrl={playerFaceUrl} onFaceUploaded={onFaceUploaded} />
            </div>

            <div className="w-full mb-6">
              <label className="items-center block text-sm font-semibold text-gray-200 uppercase mb-3">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter name..."
                maxLength={20}
                className="w-full h-14 rounded-2xl bg-white/20 border border-white/40 px-5 text-white text-lg font-semibold placeholder-gray-400 focus:outline-none focus:border-white/80 focus:bg-white/25 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] transition-[border-color,background-color] duration-150"
              />
            </div>

            <div className="flex flex-col gap-3 w-full">
              <Button onClick={() => handleAction(onCreateGame)} disabled={!ready || registering} className="w-full justify-center">
                {registering ? 'Loading...' : 'Create Game'}
              </Button>
              <Button onClick={() => handleAction(onJoinGame)} disabled={!ready || registering} className="w-full justify-center">
                {registering ? 'Loading...' : 'Join Game'}
              </Button>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-400">{error}</p>
            )}

            {!ready && (
              <p className="mt-5 text-sm text-gray-400 tracking-wide">
                {!playerFaceId ? 'Register your photo first.' : 'Enter your name to continue.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
