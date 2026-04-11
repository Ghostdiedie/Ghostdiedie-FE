import { useEffect, useRef, useState } from 'react'
import { createRoom, confirmRoom, getRoomStatus, createWebSocket } from '../api/client'
import Button from '../components/Button'
import FaceUpload from '../components/FaceUpload'
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

export default function CreateRoom({ userId, playerName, playerFaceUrl, playerFaceId, onFaceUploaded, onGameStart, onBack }) {
  const [roomCode, setRoomCode] = useState(null)
  // creating | waiting | guest_joined | confirming | waiting_confirm | connecting | error
  const [phase, setPhase] = useState('creating')
  const [guest, setGuest] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef(null)
  const wsRef = useRef(null)

  // 1. Create room on mount
  useEffect(() => {
    let alive = true

    async function init() {
      try {
        const data = await createRoom(userId)
        if (!alive) return
        setRoomCode(data.code)
        setPhase('waiting')
      } catch (err) {
        if (alive) { setPhase('error'); setErrorMsg(err.message) }
      }
    }

    init()
    return () => { alive = false }
  }, [userId])

  // 2. Poll room/status while waiting for guest or confirm
  useEffect(() => {
    if (!roomCode || phase === 'creating' || phase === 'connecting' || phase === 'error') return

    let alive = true
    pollRef.current = setInterval(async () => {
      try {
        const status = await getRoomStatus(roomCode)
        if (!alive) return

        // Guest joined
        if (status.guest && phase === 'waiting') {
          setGuest(status.guest)
          setPhase('guest_joined')
        }

        // Both confirmed → connect WebSocket
        if (status.both_confirmed && phase === 'waiting_confirm') {
          clearInterval(pollRef.current)
          setPhase('connecting')
          connectWebSocket(roomCode, alive)
        }
      } catch {
        // Ignore poll errors
      }
    }, 1500)

    return () => { alive = false; clearInterval(pollRef.current) }
  }, [roomCode, phase])

  function connectWebSocket(code) {
    const ws = createWebSocket(code)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'game_start') {
          onGameStart()
        }
      } catch { /* ignore */ }
    }

    ws.onerror = () => {
      setPhase('error')
      setErrorMsg('WebSocket connection failed')
    }
  }

  async function handleConfirm() {
    setPhase('confirming')
    try {
      const data = await confirmRoom(roomCode, userId)
      if (data.both_confirmed) {
        setPhase('connecting')
        connectWebSocket(roomCode)
      } else {
        setPhase('waiting_confirm')
      }
    } catch (err) {
      setPhase('error')
      setErrorMsg(err.message)
    }
  }

  function handleBack() {
    clearInterval(pollRef.current)
    wsRef.current?.close()
    onBack()
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <button
        onClick={handleBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-150 text-sm font-medium tracking-wide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="relative z-10 flex items-center gap-12 px-8 max-w-[1040px] w-full">
        <div className="shrink-0 flex-1 flex justify-center">
          <img
            src={logoImg}
            alt="Ghost Die Die"
            className="w-[clamp(260px,34vw,500px)] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
          />
        </div>

        <div className="flex-1 flex justify-center">
        <div className="flex flex-col items-center bg-black/60 backdrop-blur-xl border border-white/20 rounded-[28px] px-10 py-10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] w-[360px]">

        {/* Face upload */}
        <div className="w-full mb-5">
          <FaceUpload faceUrl={playerFaceUrl} onFaceUploaded={onFaceUploaded} />
        </div>

        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-4">
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

        {phase !== 'creating' && phase !== 'error' && roomCode && (
          <div className="flex flex-col items-center w-full">
            <p className="text-sm font-semibold tracking-[0.15em] text-gray-200 uppercase mb-4">
              Room Code
            </p>

            <div className="w-full bg-white/20 border border-white/40 rounded-[20px] py-5 flex items-center justify-center mb-2">
              <span className="font-black text-4xl tracking-[0.25em] text-white">
                {roomCode}
              </span>
            </div>

            <p className="text-xs text-gray-400 mb-6">
              Share this code with your friend
            </p>

            {/* Waiting for guest */}
            {phase === 'waiting' && (
              <div className="flex items-center gap-2 text-gray-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Waiting for opponent</span>
              </div>
            )}

            {/* Guest joined → show info + confirm */}
            {phase === 'guest_joined' && guest && (
              <div className="flex flex-col items-center gap-5 w-full mb-2">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs text-gray-400 tracking-widest uppercase">Opponent</span>
                  <div className="flex items-center gap-3">
                    {guest.profile_image_url && (
                      <img src={guest.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/30" />
                    )}
                    <span className="text-2xl font-black text-white">{guest.name}</span>
                  </div>
                  <span className="text-xs text-green-400 tracking-wide">joined!</span>
                </div>
                <Button onClick={handleConfirm} className="w-full justify-center">
                  Confirm
                </Button>
              </div>
            )}

            {/* Confirming */}
            {phase === 'confirming' && (
              <div className="flex items-center gap-2 text-gray-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Confirming...</span>
              </div>
            )}

            {/* Waiting for opponent confirm */}
            {phase === 'waiting_confirm' && (
              <div className="flex items-center gap-2 text-gray-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Waiting for opponent to confirm</span>
              </div>
            )}

            {/* Connecting WebSocket */}
            {phase === 'connecting' && (
              <div className="flex items-center gap-2 text-green-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Starting game...</span>
              </div>
            )}

            {phase !== 'connecting' && phase !== 'confirming' && (
              <button
                onClick={handleBack}
                className="mt-3 text-sm text-white/40 hover:text-white/70 transition-colors duration-150"
              >
                ← Back
              </button>
            )}
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  )
}
