import { useEffect, useRef, useState } from 'react'
import { createRoom, createWebSocket } from '../api/client'
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

export default function CreateRoom({ onGameStart, onBack }) {
  const [roomCode, setRoomCode] = useState(null)
  const [phase, setPhase] = useState('creating') // creating | waiting | joined | error
  const [errorMsg, setErrorMsg] = useState('')
  const wsRef = useRef(null)

  useEffect(() => {
    let alive = true

    async function init() {
      try {
        const data = await createRoom()
        if (!alive) return
        setRoomCode(data.room_code)
        setPhase('waiting')

        const ws = createWebSocket(data.room_code)
        wsRef.current = ws

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'GAME_START' && alive) {
              setPhase('joined')
              setTimeout(() => { if (alive) onGameStart(data.room_code) }, 700)
            }
          } catch {
            // Ignore malformed socket payloads.
          }
        }

        ws.onerror = () => { if (alive) { setPhase('error'); setErrorMsg('Connection error. Try again.') } }
      } catch (err) {
        if (alive) { setPhase('error'); setErrorMsg(err.message) }
      }
    }

    init()
    return () => { alive = false; wsRef.current?.close() }
  }, [onGameStart])

  function handleBack() { wsRef.current?.close(); onBack() }

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

        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Dots />
            <p className="text-sm text-gray-400 tracking-wide">Creating room...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-red-400 text-center">{errorMsg}</p>
            <Button onClick={handleBack} className="w-full justify-center">Back</Button>
          </div>
        )}

        {(phase === 'waiting' || phase === 'joined') && roomCode && (
          <div className="flex flex-col items-center w-full">
            <p className="text-sm font-semibold tracking-[0.15em] text-gray-200 uppercase mb-4">
              Room Code
            </p>

            {/* Code display */}
            <div className="w-full bg-white/20 border border-white/40 rounded-[20px] py-5 flex items-center justify-center mb-2">
              <span className="font-black text-5xl tracking-[0.35em] text-white">
                {roomCode}
              </span>
            </div>

            <p className="text-xs text-gray-400 mb-8">
              Share this code with your friend
            </p>

            {phase === 'waiting' ? (
              <div className="flex items-center gap-2 text-gray-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Waiting for opponent</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-400 mb-8">
                <span className="text-sm font-medium tracking-wide">Opponent joined!</span>
              </div>
            )}

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
