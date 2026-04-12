import { useRef, useState } from 'react'
import { joinRoom, confirmRoom, getRoomStatus } from '../api/client'
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

export default function JoinRoom({ userId, playerFaceUrl, onOpponentFaceUrl, onJoined, onBack }) {
  const [code, setCode] = useState('')
  // idle | joining | joined | confirming | waiting_confirm | connecting | error
  const [phase, setPhase] = useState('idle')
  const [owner, setOwner] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef(null)

  function handleCodeChange(e) {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8)
    setCode(val)
    if (errorMsg) setErrorMsg('')
  }

  async function handleJoin() {
    if (code.length !== 8 || phase !== 'idle') return
    setPhase('joining')

    try {
      const data = await joinRoom(code, userId)
      setOwner(data.owner)
      onOpponentFaceUrl(data.owner.profile_image_url || null)
      setPhase('joined')
    } catch (err) {
      setPhase('idle')
      setErrorMsg(err.message)
    }
  }

  async function handleConfirm() {
    setPhase('confirming')
    try {
      const data = await confirmRoom(code, userId)
      if (data.both_confirmed) {
        onJoined(code)
      } else {
        setPhase('waiting_confirm')
        startPolling(code)
      }
    } catch (err) {
      setPhase('error')
      setErrorMsg(err.message)
    }
  }

  function startPolling(roomCode) {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getRoomStatus(roomCode)
        if (status.both_confirmed) {
          clearInterval(pollRef.current)
          onJoined(roomCode)
        }
      } catch { /* ignore */ }
    }, 1500)
  }

  function handleBack() {
    clearInterval(pollRef.current)
    onBack()
  }

  const isLoading = phase === 'joining'

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
          <FaceUpload
            faceUrl={playerFaceUrl}
            readOnly
            helperText="You can only join a room with your registered profile photo."
          />
        </div>

        {/* Code input phase */}
        {(phase === 'idle' || phase === 'joining') && (
          <>
            <p className="text-sm font-semibold tracking-[0.15em] text-gray-200 uppercase mb-4">
              Enter Room Code
            </p>

            <div className="w-full bg-white/20 border border-white/40 rounded-[20px] flex items-center justify-center py-4 mb-2">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={handleCodeChange}
                placeholder="12345678"
                maxLength={8}
                disabled={isLoading}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                className="bg-transparent font-black text-4xl tracking-[0.25em] text-white text-center placeholder-white/30 focus:outline-none w-full disabled:opacity-50"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 mb-4 mt-1">{errorMsg}</p>
            )}

            <div className="h-3 mb-6" />

            {isLoading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Dots />
                <span className="text-sm tracking-wide">Joining...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                <Button onClick={handleJoin} disabled={code.length !== 8} className="w-full justify-center">
                  Join
                </Button>
              </div>
            )}
          </>
        )}

        {/* Joined → show owner info + confirm */}
        {phase === 'joined' && owner && (
          <div className="flex flex-col items-center gap-5 w-full">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-gray-400 tracking-widest uppercase">Your Opponent</span>
              <div className="flex items-center gap-3">
                {owner.profile_image_url && (
                  <img src={owner.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/30" />
                )}
                <span className="text-2xl font-black text-white">{owner.name}</span>
              </div>
            </div>
            <Button onClick={handleConfirm} className="w-full justify-center">
              Confirm
            </Button>
          </div>
        )}

        {/* Confirming */}
        {phase === 'confirming' && (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <Dots />
            <span className="text-sm tracking-wide">Confirming...</span>
          </div>
        )}

        {/* Waiting for owner to confirm */}
        {phase === 'waiting_confirm' && (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <Dots />
            <span className="text-sm tracking-wide">Waiting for host to confirm</span>
          </div>
        )}

        {/* Connecting */}
        {phase === 'connecting' && (
          <div className="flex items-center gap-2 text-green-400 py-4">
            <Dots />
            <span className="text-sm tracking-wide">Starting game...</span>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-red-400 text-center">{errorMsg}</p>
            <Button onClick={handleBack} className="w-full justify-center">Return to Lobby</Button>
          </div>
        )}

        </div>
        </div>
      </div>
    </div>
  )
}
