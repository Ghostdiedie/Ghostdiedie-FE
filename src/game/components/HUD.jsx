import { useEffect, useState } from 'react'
import { MAX_HP } from '../constants/combat'

export function HUD({
  playerHp,
  opponentHp,
  playerSkill,
  opponentSkill,
  playerName,
  opponentName,
  playerFaceUrl,
  opponentFaceUrl,
  localCvCanvasAttachRef,
  cvMode,
  cvStatus,
  cvLastDetected,
}) {
  const [state, setState] = useState({
    playerHp: MAX_HP,
    opponentHp: MAX_HP,
    playerSkill: 0,
    opponentSkill: 0,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setState({
        playerHp: playerHp.current,
        opponentHp: opponentHp.current,
        playerSkill: playerSkill?.current ?? 0,
        opponentSkill: opponentSkill?.current ?? 0,
      })
    }, 33)
    return () => clearInterval(interval)
  }, [playerHp, opponentHp, playerSkill, opponentSkill])

  const p1Pct = (state.playerHp / MAX_HP) * 100
  const p2Pct = (state.opponentHp / MAX_HP) * 100

  return (
    <div className="pointer-events-none absolute inset-0 z-10">

      {/* ── Round (top-center) ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 bg-black/50 border border-white/8 rounded px-5 py-2">
        <span className="text-[9px] font-bold tracking-[0.22em] text-white/35 uppercase">Round</span>
        <span className="text-[30px] font-extrabold text-white leading-none tracking-wide">01</span>
        <div className="flex gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
        </div>
      </div>

      {/* ── Player cam + panel (bottom-left) ── */}
      <div className="absolute bottom-[52px] left-4 flex w-[220px] md:w-[260px] lg:w-[300px] flex-col">
        {/* Player CV canvas */}
        <div className="w-full aspect-video bg-black/45 border border-white/10 border-b-0 overflow-hidden flex items-center justify-center text-white/15">
          <canvas ref={localCvCanvasAttachRef} className="w-full h-full object-cover" />
        </div>
        {/* Player panel */}
        <div className="flex items-center gap-2.5 bg-black/55 border border-white/10 pl-2.5 pr-4 py-2">
          <Portrait faceUrl={playerFaceUrl} />
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] font-bold tracking-wide text-white/70 truncate max-w-[90px]">
                {playerName || 'Player'}
              </span>
              <span className="text-[22px] font-extrabold text-white leading-none">{state.playerHp}</span>
            </div>
            <SegGauge pct={state.playerSkill} />
            <HpBar pct={p1Pct} />
          </div>
        </div>
      </div>

      {/* ── Enemy panel (bottom-right, no camera) ── */}
      <div className="absolute bottom-[52px] right-4 flex w-[220px] md:w-[260px] lg:w-[300px] flex-col items-end">
        <div className="flex items-center gap-2.5 bg-black/55 border border-white/10 pl-4 pr-2.5 py-2 w-full">
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex justify-between items-baseline">
              <span className="text-[22px] font-extrabold text-white leading-none">{state.opponentHp}</span>
              <span className="text-[11px] font-bold tracking-wide text-white/70 truncate max-w-[90px] text-right">
                {opponentName || 'Enemy'}
              </span>
            </div>
            <SegGauge pct={state.opponentSkill} rtl />
            <HpBar pct={p2Pct} rtl />
          </div>
          <Portrait faceUrl={opponentFaceUrl} />
        </div>
      </div>

      {/* ── Controls (bottom-center) ── */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 border border-white/6 rounded px-3.5 py-1.5">
        {cvMode ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <Hint>CV Mode — punch to attack</Hint>
            <Sep />
            <Hint>{formatCvStatus(cvStatus, cvLastDetected)}</Hint>
            <Sep />
            <Key k="Tab" wide /><Hint>switch</Hint>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Key k="W" /><Key k="A" /><Key k="S" /><Key k="D" />
            </div>
            <Sep />
            <div className="flex items-center gap-1">
              <Key k="Space" wide /><Hint>jump</Hint>
            </div>
            <Sep />
            <div className="flex items-center gap-1">
              <Key k="Q" /><Hint>왼손</Hint>
              <Key k="E" /><Hint>킥</Hint>
              <Key k="F" /><Hint>오른손</Hint>
            </div>
            <Sep />
            <Key k="Tab" wide /><Hint>CV</Hint>
          </>
        )}
      </div>

    </div>
  )
}

/* ── Sub-components ─────────────────────────── */

function Portrait({ faceUrl }) {
  return (
    <div className="shrink-0 w-14 h-14 rounded-[3px] bg-white/5 border border-white/10 flex flex-col items-center justify-center text-white/20 overflow-hidden relative">
      {faceUrl ? (
        <img src={faceUrl} alt="portrait" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}

const SEGMENTS = 4

function SegGauge({ pct, rtl = false }) {
  const filled = (pct / 100) * SEGMENTS
  const ready  = pct >= 100

  return (
    <div className={`flex gap-[3px] ${rtl ? 'flex-row-reverse' : ''}`}>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const segFill = Math.min(1, Math.max(0, filled - i)) * 100
        return (
          <div key={i} className="flex-1 h-[5px] bg-white/8 overflow-hidden relative">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true">
              <rect
                x="0"
                y="0"
                width={segFill}
                height="5"
                fill={ready ? '#a3e635' : 'rgba(255,255,255,0.38)'}
              />
            </svg>
          </div>
        )
      })}
    </div>
  )
}

function HpBar({ pct, rtl = false }) {
  const color = pct > 60 ? '#4ade80' : pct > 30 ? '#facc15' : '#f87171'
  const x = rtl ? 100 - pct : 0
  return (
    <div className="relative h-2 bg-white/10 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <rect x={x} y="0" width={pct} height="8" fill={color} />
      </svg>
    </div>
  )
}

function Key({ k, wide = false }) {
  return (
    <kbd className={`inline-flex items-center justify-center h-[22px] rounded-[3px] bg-white/8 border border-white/15 text-[9px] font-bold text-white/55 uppercase tracking-wide ${wide ? 'px-2.5' : 'w-[22px]'}`}>
      {k}
    </kbd>
  )
}

function Hint({ children }) {
  return <span className="text-[9px] text-white/25 tracking-wide">{children}</span>
}

function Sep() {
  return <span className="w-px h-4 bg-white/10 mx-0.5" />
}

function formatCvStatus(status, lastDetected) {
  if (status === 'connecting') return 'CV bridge connecting'
  if (status === 'offline') return 'CV bridge offline'
  if (status === 'loading') return 'CV loading'
  if (status === 'error') return 'CV error'
  if (status === 'ready' && lastDetected?.action) return `last ${lastDetected.action}`
  if (status === 'ready') return 'CV ready'
  return 'CV idle'
}
