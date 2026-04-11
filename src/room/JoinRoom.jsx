import { useRef, useState } from 'react'
import { joinRoom, createWebSocket } from '../api/client'
import Button from '../components/Button'
import backgroundImg from '../assets/background/background.webp'
import logoImg from '../assets/background/logo.webp'

function Dots() {
  return (
    <div className="flex gap-1.5 items-center">
      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:300ms]" />
    </div>
  )
}

export default function JoinRoom({ onJoined, onBack }) {
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState('idle') // idle | joining | connecting | error
  const [errorMsg, setErrorMsg] = useState('')
  const wsRef = useRef(null)

  function handleCodeChange(e) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    setCode(val)
    if (errorMsg) setErrorMsg('')
  }

  async function handleJoin() {
    if (code.length !== 4 || phase !== 'idle') return
    setPhase('joining')

    try {
      await joinRoom(code)
      setPhase('connecting')

      const ws = createWebSocket(code)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'GAME_START') onJoined(code)
        } catch {
          // Ignore malformed socket payloads.
        }
      }

      ws.onerror = () => { setPhase('idle'); setErrorMsg('Connection error. Try again.') }
    } catch (err) {
      setPhase('idle')
      setErrorMsg(err.message)
    }
  }

  function handleBack() { wsRef.current?.close(); onBack() }

  const isLoading = phase === 'joining' || phase === 'connecting'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-150 text-sm font-medium tracking-wide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Content: Logo left + Card right */}
      <div className="relative z-10 flex items-center gap-12 px-8 max-w-[1040px] w-full">

        {/* Logo */}
        <div className="shrink-0 flex-1 flex justify-center">
          <img
            src={logoImg}
            alt="Ghost Die Die"
            className="w-[clamp(260px,34vw,500px)] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
          />
        </div>

        {/* Card */}
        <div className="flex-1 flex justify-center">
        <div className="flex flex-col items-center bg-black/60 backdrop-blur-xl border border-white/20 rounded-[28px] px-10 py-10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] w-[360px]">

        <p className="text-sm font-semibold tracking-[0.15em] text-gray-200 uppercase mb-4">
          Enter Room Code
        </p>

        {/* Code input */}
        <div className="w-full bg-white/20 border border-white/40 rounded-[20px] flex items-center justify-center py-4 mb-2">
          <input
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder="ABCD"
            maxLength={4}
            disabled={isLoading}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            className="bg-transparent font-black text-4xl tracking-[0.4em] text-white text-center placeholder-white/30 focus:outline-none w-full disabled:opacity-50"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 mb-4 mt-1">{errorMsg}</p>
        )}

        <div className="h-3 mb-6" />

        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Dots />
            <span className="text-sm tracking-wide">
              {phase === 'joining' ? 'Joining...' : 'Connecting...'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <Button onClick={handleJoin} disabled={code.length !== 4} className="w-full justify-center">
              Join
            </Button>
            <Button onClick={handleBack} className="w-full justify-center">
              Back
            </Button>
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  )
}
