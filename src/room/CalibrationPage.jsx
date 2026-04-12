import { useEffect, useRef, useState } from 'react'
import Button from '../components/Button'
import { getRoomStatus } from '../api/client'
import backgroundImg from '../assets/background/background.webp'

const COUNTDOWN_SEC = 5
const CAL_DURATION_MS = 4200  // 120프레임 @ 30fps ≈ 4초 + 여유

function StatusDot({ active, color = 'bg-green-400' }) {
  return <span className={`h-2.5 w-2.5 rounded-full ${active ? color : 'bg-white/20'}`} />
}

function PersonSilhouette() {
  return (
    <svg
      viewBox="0 0 160 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-auto"
    >
      {/* 사람 몸 윤곽선 — 하나의 연속된 path */}
      <path
        d="
          M80,4
          C95,4 110,16 110,36
          C110,56 97,68 80,68
          C63,68 50,56 50,36
          C50,16 65,4 80,4
          Z

          M57,72
          C48,74 40,80 36,90
          L20,130
          C18,136 22,142 28,142
          L38,142
          L30,200
          C28,210 32,218 40,220
          L44,220
          L36,300
          C34,312 40,322 50,324
          L54,324
          C58,324 62,320 62,316
          L68,240
          L80,240
          L92,240
          L98,316
          C98,320 102,324 106,324
          L110,324
          C120,322 126,312 124,300
          L116,220
          L120,220
          C128,218 132,210 130,200
          L122,142
          L132,142
          C138,142 142,136 140,130
          L124,90
          C120,80 112,74 103,72
          C99,78 90,82 80,82
          C70,82 61,78 57,72
          Z
        "
        stroke="white"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="10 5"
        fill="white"
        fillOpacity="0.05"
        opacity="0.75"
      />
    </svg>
  )
}

export default function CalibrationPage({ roomCode, userId, playerName, playerFaceUrl, cvBridge, onReady, onBothReady }) {
  const [phase, setPhase] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [remoteReady, setRemoteReady] = useState(false)
  const [countdown, setCountdown] = useState(null)  // null = 전, 0 = 캘리브레이션 중
  const [calDone, setCalDone] = useState(false)
  const pollRef = useRef(null)
  const countdownRef = useRef(null)
  const calDoneRef = useRef(null)
  const recalibratedRef = useRef(false)

  useEffect(() => () => {
    clearInterval(pollRef.current)
    clearInterval(countdownRef.current)
    clearTimeout(calDoneRef.current)
  }, [])

  // CV 연결되면 카운트다운 시작 (최초 1회)
  useEffect(() => {
    if (cvBridge.status === 'ready' && !recalibratedRef.current) {
      recalibratedRef.current = true
      setCountdown(COUNTDOWN_SEC)

      let remaining = COUNTDOWN_SEC
      countdownRef.current = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          clearInterval(countdownRef.current)
          setCountdown(0)
          setCalDone(false)
          cvBridge.send({ type: 'recalibrate' })
          calDoneRef.current = setTimeout(() => setCalDone(true), CAL_DURATION_MS)
        } else {
          setCountdown(remaining)
        }
      }, 1000)
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
  const isCountingDown = countdown !== null && countdown > 0
  const isCalibrating = countdown === 0 && !calDone

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
              disabled={!cvReady || isCountingDown || isCalibrating || phase === 'submitting' || phase === 'waiting'}
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
            {cvBridge.lastAction?.action && !isCountingDown && !isCalibrating && (
              <div className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-green-300">
                {cvBridge.lastAction.action}
              </div>
            )}
          </div>

          {/* 카메라 피드 + 오버레이 */}
          <div className="relative aspect-video overflow-hidden rounded-[24px] border border-white/10 bg-black">
            <canvas ref={cvBridge.attachDisplayCanvasRef} className="h-full w-full object-cover" />

            {/* 카운트다운 오버레이 */}
            {(isCountingDown || isCalibrating || calDone) && (
              <div className={`absolute inset-0 flex flex-col items-end justify-end transition-all duration-500 ${calDone ? 'bg-black/30' : 'bg-black/55'}`}>
                {/* 사람 윤곽선 — 화면 중앙 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <PersonSilhouette />
                </div>
                {/* 텍스트 — 하단 */}
                <div className="relative z-10 w-full pb-4 text-center">
                  {isCountingDown ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/70">이 윤곽선 안에 맞춰 서세요</p>
                      <p className="text-6xl font-black text-white drop-shadow-lg">{countdown}</p>
                    </>
                  ) : isCalibrating ? (
                    <>
                      <p className="text-base font-bold text-yellow-300">캘리브레이션 중...</p>
                      <p className="text-xs text-white/50">가만히 서계세요</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-black text-green-400">✓ 캘리브레이션 완료</p>
                      <p className="text-xs text-white/50">Ready 버튼을 눌러주세요</p>
                    </>
                  )}
                </div>
              </div>
            )}
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
