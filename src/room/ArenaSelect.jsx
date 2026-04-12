import { useEffect, useState } from 'react'
import { getRoomStatus } from '../api/client'
import backgroundImg from '../assets/background/background.webp'

const ARENAS = [
  {
    key: 'arena',
    name: 'Underground\nBrutalism Arena',
    tag: 'FIGHT NIGHT',
    tagColor: '#facc15',
    desc: 'Raw concrete. Iron cage. No mercy.',
    accentColor: '#facc15',
    borderSelected: 'border-yellow-400',
    shadowSelected: '0 0 60px rgba(250,204,21,0.35)',
    badgeBg: 'bg-yellow-400',
    badgeText: 'text-black',
  },
  {
    key: 'arena2',
    name: 'Neon Synthwave\nGrid Arena',
    tag: 'CYBER FIGHT',
    tagColor: '#00e5ff',
    desc: 'Neon grids. Virtual space. Cyber combat.',
    accentColor: '#00e5ff',
    borderSelected: 'border-cyan-400',
    shadowSelected: '0 0 60px rgba(0,229,255,0.35)',
    badgeBg: 'bg-cyan-400',
    badgeText: 'text-black',
  },
]

// ─── CSS-based visual preview ─────────────────────────────────────────────────
function UndergroundPreview() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#131110]">
      {/* Hazard stripe top bar */}
      <div className="absolute top-0 left-0 right-0 h-7 flex z-10">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-yellow-400' : 'bg-black'}`} />
        ))}
      </div>
      {/* Concrete floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[55%] bg-[#28251f]" />
      {/* Floor texture lines */}
      {[20, 40, 60, 80].map((pct, i) => (
        <div key={i} className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#3a342c]"
          style={{ bottom: `${pct * 0.55}%` }} />
      ))}
      {/* Octagon cage silhouette */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-44 h-36 flex items-center justify-center">
          {/* Cage panels */}
          <div className="absolute inset-0 border-2 border-yellow-400/50"
            style={{ transform: 'rotate(22.5deg)', borderRadius: 2 }} />
          <div className="absolute inset-[10px] border border-yellow-400/25"
            style={{ borderRadius: 2 }} />
          {/* Centre mat */}
          <div className="w-20 h-16 rounded border border-yellow-400/30 bg-[#1c1814]" />
        </div>
      </div>
      {/* Overhead lights */}
      <div className="absolute top-10 left-0 right-0 flex justify-center gap-10">
        {[0, 1, 2].map(i => (
          <div key={i}>
            <div className="w-1 h-3 bg-[#555] mx-auto" />
            <div className="w-5 h-3 rounded bg-[#333] flex items-center justify-center">
              <div className="w-3 h-1 rounded-full bg-yellow-100"
                style={{ boxShadow: '0 0 8px 4px rgba(255,248,200,0.45)' }} />
            </div>
          </div>
        ))}
      </div>
      {/* Banner text */}
      <div className="absolute top-10 left-4 z-10">
        <div className="text-[8px] font-black text-yellow-400 tracking-widest uppercase leading-tight"
          style={{ textShadow: '0 0 6px rgba(250,204,21,0.8)' }}>
          RAW FIGHTS<br />NO RULES
        </div>
      </div>
      <div className="absolute top-10 right-4 z-10">
        <div className="text-[8px] font-black text-yellow-400 tracking-widest uppercase leading-tight text-right"
          style={{ textShadow: '0 0 6px rgba(250,204,21,0.8)' }}>
          LIVE COMBAT<br />FIGHT NIGHT
        </div>
      </div>
      {/* Crowd silhouettes */}
      <div className="absolute bottom-[54%] left-0 right-0 flex justify-around px-2 opacity-60">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-[1px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2a2520]" />
            <div className="w-2 h-3 bg-[#1e1c18] rounded-sm" />
          </div>
        ))}
      </div>
      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
    </div>
  )
}

function SynthwavePreview() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#04040e]">
      {/* Ceiling grid */}
      <div className="absolute top-0 left-0 right-0 h-[38%]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="absolute left-0 right-0 h-[1px]"
            style={{ top: `${10 + i * 14}%`, background: 'rgba(0,229,255,0.25)' }} />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0 w-[1px]"
            style={{ left: `${5 + i * 11.5}%`, background: 'rgba(255,45,120,0.2)' }} />
        ))}
      </div>
      {/* Floor grid - horizontal cross lines */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="absolute left-0 right-0 h-[1px]"
          style={{
            bottom: `${3 + i * 9}%`,
            background: 'rgba(0,229,255,0.55)',
            boxShadow: '0 0 3px rgba(0,229,255,0.7)',
          }} />
      ))}
      {/* Floor grid - vertical depth lines (perspective effect) */}
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="absolute bottom-0 w-[1px]"
          style={{
            left: `${8 + i * 10.5}%`,
            height: '55%',
            background: 'rgba(255,45,120,0.65)',
            boxShadow: '0 0 3px rgba(255,45,120,0.8)',
          }} />
      ))}
      {/* Synthwave sunset */}
      <div className="absolute"
        style={{
          bottom: '50%', left: '50%',
          transform: 'translateX(-50%)',
          width: 72, height: 36,
          borderRadius: '36px 36px 0 0',
          background: 'linear-gradient(180deg, #ff8c00 0%, #ff2d78 100%)',
          boxShadow: '0 0 24px 6px rgba(255,45,120,0.5)',
        }} />
      {/* Horizon cut lines */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="absolute bg-[#04040e]"
          style={{
            bottom: `${50 + i * 5.5}%`,
            left: '50%', transform: 'translateX(-50%)',
            width: 72, height: 2 + i * 0.5,
          }} />
      ))}
      {/* Mountain silhouettes */}
      <svg className="absolute bottom-[49%] left-0 right-0 w-full" height="40" viewBox="0 0 400 40" preserveAspectRatio="none">
        <path d="M0,40 L50,15 L100,28 L160,5 L200,0 L240,5 L300,28 L350,15 L400,40 Z" fill="#06061a" />
      </svg>
      {/* Neon fight ring */}
      <div className="absolute"
        style={{
          bottom: '15%', left: '50%', transform: 'translateX(-50%)',
          width: 90, height: 90, borderRadius: '50%',
          border: '2px solid rgba(255,45,120,0.85)',
          boxShadow: '0 0 12px rgba(255,45,120,0.5), inset 0 0 12px rgba(255,45,120,0.15)',
        }} />
      {/* Corner neon pillars */}
      {[-1, 1].map(side => (
        <div key={side} className="absolute top-0 bottom-0 w-[2px]"
          style={{
            [side === -1 ? 'left' : 'right']: '12%',
            background: 'rgba(0,229,255,0.7)',
            boxShadow: '0 0 6px rgba(0,229,255,0.9)',
          }} />
      ))}
      {/* Arch frames */}
      {[0.7, 0.85, 1.0].map((scale, i) => (
        <div key={i} className="absolute inset-0 flex items-start justify-center pointer-events-none">
          <div className="border border-cyan-500/20 w-full"
            style={{
              width: `${scale * 96}%`,
              height: `${scale * 88}%`,
              marginTop: `${(1 - scale) * 8}%`,
              borderColor: i === 2 ? 'rgba(0,229,255,0.35)' : 'rgba(255,45,120,0.2)',
            }} />
        </div>
      ))}
      {/* Ambient purple fog */}
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(80,0,160,0.18) 0%, transparent 70%)' }} />
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
    </div>
  )
}

// ─── Arena card ───────────────────────────────────────────────────────────────
function ArenaCard({ arena, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'group relative w-[380px] h-[300px] rounded-3xl overflow-hidden border-2 transition-all duration-300 text-left shrink-0',
        selected
          ? `${arena.borderSelected} scale-[1.03]`
          : 'border-white/15 hover:border-white/30 hover:scale-[1.01]',
        disabled ? 'cursor-default' : 'cursor-pointer',
      ].join(' ')}
      style={selected ? { boxShadow: arena.shadowSelected } : {}}
    >
      {/* Visual preview */}
      {arena.key === 'arena' ? <UndergroundPreview /> : <SynthwavePreview />}

      {/* Bottom gradient + info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <span className="text-[10px] font-black tracking-[0.3em] uppercase"
          style={{ color: arena.tagColor, textShadow: `0 0 8px ${arena.tagColor}88` }}>
          {arena.tag}
        </span>
        <h3 className="text-[17px] font-black text-white mt-1 leading-tight whitespace-pre-line">
          {arena.name}
        </h3>
        <p className="text-xs text-white/50 mt-1">{arena.desc}</p>
      </div>

      {/* Selected badge */}
      {selected && (
        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${arena.badgeBg} ${arena.badgeText}`}>
          Selected
        </div>
      )}
    </button>
  )
}

// ─── Guest waiting screen ────────────────────────────────────────────────────
function GuestWaiting({ roomCode, onDone }) {
  const [errorMsg, setErrorMsg] = useState('')
  const [delayed, setDelayed] = useState(false)

  useEffect(() => {
    let active = true
    let interval = null
    let failures = 0

    setDelayed(false)
    setErrorMsg('')

    async function pollStatus() {
      try {
        const status = await getRoomStatus(roomCode)
        if (!active) return
        failures = 0
        setErrorMsg('')

        const arenaKey = (
          status.arena_key ||
          status.arenaKey ||
          status.owner?.arena_key ||
          status.owner?.arenaKey ||
          null
        )

        if (arenaKey) {
          clearInterval(interval)
          onDone(arenaKey)
        }
      } catch (err) {
        if (!active) return
        failures += 1
        if (failures >= 3) {
          setErrorMsg(err.message || 'Failed to sync arena selection')
        }
      }
    }

    pollStatus()
    interval = setInterval(pollStatus, 1500)

    const delayTimer = setTimeout(() => {
      if (active) setDelayed(true)
    }, 10000)

    return () => {
      active = false
      clearInterval(interval)
      clearTimeout(delayTimer)
    }
  }, [roomCode, onDone])

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6">
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="text-white/60 text-sm tracking-widest uppercase">
        Waiting for host to choose the arena...
      </p>
      {delayed && !errorMsg && (
        <p className="text-xs text-white/45 text-center">
          Host selection is taking longer than expected. Waiting for room sync.
        </p>
      )}
      {errorMsg && (
        <p className="text-xs text-red-400 text-center">{errorMsg}</p>
      )}
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function ArenaSelect({ isOwner, roomCode, onArenaSelected, onBack }) {
  const [selected, setSelected] = useState('arena')
  const [confirming, setConfirming] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleConfirm() {
    if (confirming) return
    setConfirming(true)
    setErrorMsg('')

    try {
      await onArenaSelected(selected)
    } catch (err) {
      setConfirming(false)
      setErrorMsg(err.message || 'Failed to save arena selection')
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden select-none">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `url(${backgroundImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="absolute inset-0 bg-black/68" />

      {/* Back button */}
      {isOwner && (
        <button onClick={onBack}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium tracking-wide">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      {/* Title */}
      <div className="relative z-10 pt-10 pb-4 text-center">
        {isOwner && (
          <p className="text-[10px] font-bold tracking-[0.35em] text-white/35 uppercase mb-2">
            Host Selection
          </p>
        )}
        <h1 className="text-[clamp(2rem,5vw,3rem)] font-black text-white tracking-wide uppercase">
          {isOwner ? 'Choose Your Arena' : 'Choose Your Arena'}
        </h1>
        <p className="text-sm text-white/45 mt-2">
          {isOwner
            ? 'Select the battlefield — only you can choose'
            : 'Waiting for the host to pick an arena…'}
        </p>
      </div>

      {/* Content */}
      {isOwner ? (
        <div className="relative z-10 flex flex-1 items-center justify-center gap-8 px-8 py-4 flex-wrap">
          {ARENAS.map(arena => (
            <ArenaCard
              key={arena.key}
              arena={arena}
              selected={selected === arena.key}
              disabled={confirming}
              onClick={() => !confirming && setSelected(arena.key)}
            />
          ))}
        </div>
      ) : (
        <GuestWaiting roomCode={roomCode} onDone={onArenaSelected} />
      )}

      {/* Confirm button (owner only) */}
      {isOwner && (
        <div className="relative z-10 flex flex-col items-center gap-3 pb-10">
          {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-16 py-4 rounded-2xl bg-yellow-400 text-black font-black text-lg tracking-wider uppercase hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? 'Confirming...' : 'Confirm Arena'}
          </button>
        </div>
      )}
    </div>
  )
}
