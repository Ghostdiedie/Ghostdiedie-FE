import { useEffect, useRef, useState } from 'react'
import Button from '../components/Button'
import { getRoomStatus } from '../api/client'
import backgroundImg from '../assets/background/background.webp'

function StatusDot({ active, color = 'bg-green-400' }) {
  return <span className={`h-2.5 w-2.5 rounded-full ${active ? color : 'bg-white/20'}`} />
}

export default function CalibrationPage({ roomCode, userId, playerName, playerFaceUrl, cvBridge, onReady, onBothReady }) {
  const [phase, setPhase] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [remoteReady, setRemoteReady] = useState(false)
  const pollRef = useRef(null)
  const recalibratedRef = useRef(false)

  useEffect(() => () => clearInterval(pollRef.current), [])

  // 페이지 진입 후 CV 연결되면 재캘리브레이션 트리거 (최초 1회)
  useEffect(() => {
    if (cvBridge.status === 'ready' && !recalibratedRef.current) {
      recalibratedRef.current = true
      cvBridge.send({ type: 'recalibrate' })
    }
  }, [cvBridge.status])

  function startPolling() {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const status = await getRoomStatus(roomCode)
        const meIsOwner = status.owner?.user_id === userId
        const myReady = meIsOwner
          ? Boolean(status.owner?.calibration_ready)
          : Boolean(status.guest?.calibration_ready)
        const opponentReady = meIsOwner
          ? Boolean(status.guest?.calibration_ready)
          : Boolean(status.owner?.calibration_ready)

        setRemoteReady(opponentReady)
        if (status.both_calibrated && myReady) {
          clearInterval(pollRef.current)
          onBothReady()
        }
      } catch (err) {
        clearInterval(pollRef.current)
        setPhase('idle')
        setErrorMsg(err.message || 'Failed to sync calibration status')
      }
    }, 1200)
  }

  async function handleReady() {
    if (phase === 'submitting' || phase === 'waiting') return
    setPhase('submitting')
    setErrorMsg('')

    try {
      const result = await onReady()
      if (result?.both_calibrated) {
        onBothReady()
        return
      }
      setPhase('waiting')
      startPolling()
    } catch (err) {
      setPhase('idle')
      setErrorMsg(err.message || 'Failed to finish calibration')
    }
  }

  const cvReady = cvBridge.status === 'ready'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] items-center justify-center gap-10 px-8 py-10">
        <div className="w-[420px] rounded-[32px] border border-white/15 bg-black/55 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.4)]">
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/35">Calibration</p>
            <h1 className="mt-2 text-4xl font-black tracking-wide text-white">GET READY</h1>
            <p className="mt-3 text-sm text-white/55">
              Check the camera connection and try a few test moves. The match starts once both players are ready.
            </p>
          </div>

          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/5">
              {playerFaceUrl
                ? <img src={playerFaceUrl} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center text-white/25">?</div>}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.25em] text-white/35">Player</p>
              <p className="truncate text-lg font-bold text-white">{playerName || 'Player'}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-white/65">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span>CV bridge status</span>
              <div className="flex items-center gap-2">
                <StatusDot active={cvReady} color={cvReady ? 'bg-green-400' : 'bg-yellow-400'} />
                <span className="font-semibold capitalize text-white">{cvBridge.status}</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span>Your ready state</span>
              <div className="flex items-center gap-2">
                <StatusDot active={phase === 'waiting'} />
                <span className="font-semibold text-white">{phase === 'waiting' ? 'Ready' : 'Not ready'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span>Opponent ready state</span>
              <div className="flex items-center gap-2">
                <StatusDot active={remoteReady} />
                <span className="font-semibold text-white">{remoteReady ? 'Ready' : 'Waiting'}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
            {phase === 'waiting' && (
              <p className="text-sm text-white/55">Waiting for your opponent to finish calibration.</p>
            )}
            <Button
              onClick={handleReady}
              disabled={!cvReady || phase === 'submitting' || phase === 'waiting'}
              className="w-full justify-center"
            >
              {phase === 'submitting' ? 'Checking...' : phase === 'waiting' ? 'Waiting...' : 'Ready'}
            </Button>
          </div>
        </div>

        <div className="w-[520px] rounded-[32px] border border-white/15 bg-black/55 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.4)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/35">Live CV</p>
              <p className="mt-2 text-lg font-bold text-white">Preview & quick check</p>
            </div>
            {cvBridge.lastAction?.action && (
              <div className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-green-300">
                {cvBridge.lastAction.action}
              </div>
            )}
          </div>

          <div className="aspect-video overflow-hidden rounded-[24px] border border-white/10 bg-black">
            <canvas ref={cvBridge.attachDisplayCanvasRef} className="h-full w-full object-cover" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/55">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">Make sure left and right punches are detected.</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">Verify kick, jump, and head attacks respond correctly.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
