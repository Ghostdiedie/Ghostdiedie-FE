import { useRef, useState } from 'react'
import { joinRoom, createWebSocket } from '../api/client'
import Button from '../components/Button'

function Dots() {
  return (
    <div className="flex gap-1.5 items-center">
      {[0, 150, 300].map(d => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  )
}

export default function JoinRoom({ playerName, onJoined, onBack }) {
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
      await joinRoom(code, playerName)
      setPhase('connecting')

      const ws = createWebSocket(code)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'GAME_START') onJoined(code)
        } catch {}
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-100 flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* Background blobs */}
      <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-rose-300/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-60px] right-[-60px] w-[340px] h-[340px] rounded-full bg-orange-300/25 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center bg-white/40 backdrop-blur-xl border border-white/70 rounded-[32px] px-12 py-12 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] w-[360px]">

        <div className="font-black tracking-[0.08em] text-gray-900 text-2xl leading-none mb-1">
          GHOST<span className="text-red-500">DIEDIE</span>
        </div>
        <div className="w-8 h-px bg-gray-300 mb-8" />

        <p className="text-xs font-medium tracking-[0.2em] text-gray-400 uppercase mb-3">
          Enter Room Code
        </p>

        {/* Code input */}
        <div className="w-full bg-white/60 backdrop-blur-md border border-white/80 rounded-[20px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center py-4 mb-2">
          <input
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder="ABCD"
            maxLength={4}
            disabled={isLoading}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            className="bg-transparent font-black text-4xl tracking-[0.4em] text-gray-900 text-center placeholder-gray-300 focus:outline-none w-full disabled:opacity-50"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-500 mb-4 mt-1">{errorMsg}</p>
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
            <Button onClick={handleBack} className="w-full justify-center text-gray-500">
              ← Back
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
