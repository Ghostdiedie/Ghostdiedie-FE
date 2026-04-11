import { useEffect, useRef, useState } from 'react'
import { createRoom, createWebSocket } from '../api/client'
import Button from '../components/Button'

function Dots() {
  return (
    <div className="flex gap-1.5 items-center">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
    </div>
  )
}

export default function CreateRoom({ playerName, onGameStart, onBack }) {
  const [roomCode, setRoomCode] = useState(null)
  const [phase, setPhase] = useState('creating') // creating | waiting | joined | error
  const [errorMsg, setErrorMsg] = useState('')
  const wsRef = useRef(null)

  useEffect(() => {
    let alive = true

    async function init() {
      try {
        const data = await createRoom(playerName)
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
  }, [onGameStart, playerName])

  function handleBack() { wsRef.current?.close(); onBack() }

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-rose-100 flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* Background blobs */}
      <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-rose-300/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-60px] right-[-60px] w-[340px] h-[340px] rounded-full bg-orange-300/25 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center bg-white/40 backdrop-blur-xl border border-white/70 rounded-[32px] px-12 py-12 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] w-[360px]">

        <div className="font-black tracking-[0.08em] text-gray-900 text-2xl leading-none mb-1">
          GHOST<span className="text-red-500">DIEDIE</span>
        </div>
        <div className="w-8 h-px bg-gray-300 mb-8" />

        {/* States */}
        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Dots />
            <p className="text-sm text-gray-400 tracking-wide">Creating room...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            <Button onClick={handleBack}>Back</Button>
          </div>
        )}

        {(phase === 'waiting' || phase === 'joined') && roomCode && (
          <div className="flex flex-col items-center w-full">
            <p className="text-xs font-medium tracking-[0.2em] text-gray-400 uppercase mb-3">
              Room Code
            </p>

            {/* Code display */}
            <div className="w-full bg-white/60 backdrop-blur-md border border-white/80 rounded-[20px] py-5 flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] mb-2">
              <span className="font-black text-5xl tracking-[0.35em] text-gray-900">
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
              <div className="flex items-center gap-2 text-green-500 mb-8">
                <span className="text-sm font-medium tracking-wide">Opponent joined!</span>
              </div>
            )}

            <Button onClick={handleBack}>
              ← Back
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
