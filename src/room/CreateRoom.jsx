import { useEffect, useRef, useState } from 'react'
import { createRoom, confirmRoom, getRoomStatus } from '../api/client'
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

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function CreateRoom({ userId, playerFaceUrl, onFaceUploaded, onOpponentFaceUrl, onGameStart, onBack }) {
  const [roomCode, setRoomCode] = useState(null)
  const [phase, setPhase] = useState('creating')
  const [guest, setGuest] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef(null)
  const phaseRef = useRef(phase)
  const countdownBlocked = phase === 'connecting' || phase === 'error' || phase === 'expired'

  // Keep phaseRef in sync so polling callback reads latest phase
  useEffect(() => { phaseRef.current = phase }, [phase])

  // 1. Create room on mount
  useEffect(() => {
    let alive = true

    async function init() {
      try {
        const data = await createRoom(userId)
        if (!alive) return
        setRoomCode(data.code)
        setRemaining(data.expires_in)
        setPhase('waiting')
      } catch (err) {
        if (alive) { setPhase('error'); setErrorMsg(err.message) }
      }
    }

    init()
    return () => { alive = false }
  }, [userId])

  // 2. Local countdown timer (ticks every second)
  useEffect(() => {
    if (remaining == null || remaining <= 0) return
    if (countdownBlocked) return

    const t = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(t)
          clearInterval(pollRef.current)
          setPhase('expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(t)
  }, [countdownBlocked, remaining])

  // 3. Poll room/status
  useEffect(() => {
    if (!roomCode || phase === 'creating' || phase === 'connecting' || phase === 'error' || phase === 'expired') return

    let alive = true
    pollRef.current = setInterval(async () => {
      try {
        const status = await getRoomStatus(roomCode)
        if (!alive) return

        setRemaining(status.expires_in)

        const p = phaseRef.current
        if (status.guest && p === 'waiting') {
          setGuest(status.guest)
          onOpponentFaceUrl(status.guest.profile_image_url || null)
          setPhase('guest_joined')
        }

        if (status.both_confirmed && p === 'waiting_confirm') {
          clearInterval(pollRef.current)
          onGameStart(roomCode)
        }
      } catch (err) {
        if (!alive) return
        // 410 = expired
        if (err.message.includes('expired') || err.message.includes('410')) {
          clearInterval(pollRef.current)
          setRemaining(0)
          setPhase('expired')
        }
      }
    }, 2000)

    return () => { alive = false; clearInterval(pollRef.current) }
  }, [onGameStart, onOpponentFaceUrl, roomCode, phase])

  async function handleConfirm() {
    setPhase('confirming')
    try {
      const data = await confirmRoom(roomCode, userId)
      if (data.both_confirmed) {
        onGameStart(roomCode)
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

        {phase === 'expired' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-red-400 text-center">Room expired</p>
            <Button onClick={handleBack} className="w-full justify-center">Create New Room</Button>
          </div>
        )}

        {!['creating', 'error', 'expired'].includes(phase) && roomCode && (
          <div className="flex flex-col items-center w-full">
            <p className="text-sm font-semibold tracking-[0.15em] text-gray-200 uppercase mb-4">
              Room Code
            </p>

            <div className="w-full bg-white/20 border border-white/40 rounded-[20px] py-5 flex items-center justify-center mb-2">
              <span className="font-black text-4xl tracking-[0.25em] text-white">
                {roomCode}
              </span>
            </div>

            <div className="flex items-center justify-between w-full mb-6">
              <p className="text-xs text-gray-400">
                Share this code with your friend
              </p>
              {remaining != null && (
                <span className={`text-xs font-mono ${remaining < 60 ? 'text-red-400' : 'text-gray-400'}`}>
                  {formatTime(remaining)}
                </span>
              )}
            </div>

            {phase === 'waiting' && (
              <div className="flex items-center gap-2 text-gray-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Waiting for opponent</span>
              </div>
            )}

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

            {phase === 'confirming' && (
              <div className="flex items-center gap-2 text-gray-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Confirming...</span>
              </div>
            )}

            {phase === 'waiting_confirm' && (
              <div className="flex items-center gap-2 text-gray-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Waiting for opponent to confirm</span>
              </div>
            )}

            {phase === 'connecting' && (
              <div className="flex items-center gap-2 text-green-400 mb-8">
                <Dots />
                <span className="text-sm tracking-wide">Starting game...</span>
              </div>
            )}

            {!['connecting', 'confirming'].includes(phase) && (
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
