import { useEffect, useRef, useState } from 'react'
import Button from '../components/Button'
import { getRoomStatus } from '../api/client'
import backgroundImg from '../assets/background/background.webp'

const CHARACTERS = [
  { key: 'blue', label: 'Fighter A', color: '#2563eb', accent: '#93c5fd', suit: 'Midnight Blue' },
  { key: 'red', label: 'Fighter B', color: '#dc2626', accent: '#fca5a5', suit: 'Crimson Red' },
  { key: 'black', label: 'Fighter C', color: '#1f2937', accent: '#9ca3af', suit: 'Shadow Black' },
  { key: 'white', label: 'Fighter D', color: '#d1d5db', accent: '#ffffff', suit: 'Ivory White' },
]

function FighterCard({ character, selected, faceUrl, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex w-[220px] flex-col overflow-hidden rounded-[28px] border p-5 text-left transition-all duration-200',
        selected
          ? 'scale-[1.03] border-yellow-300 bg-white/16 shadow-[0_20px_80px_rgba(250,204,21,0.18)]'
          : 'border-white/12 bg-black/35 hover:border-white/28 hover:bg-white/10',
      ].join(' ')}
      style={{
        backgroundImage: `linear-gradient(180deg, ${character.accent}22 0%, rgba(0,0,0,0) 45%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.22em] text-white/45 uppercase">
          {character.suit}
        </span>
        <span
          className="h-3 w-3 rounded-full border border-white/20"
          style={{ backgroundColor: character.color }}
        />
      </div>

      <div className="relative mt-5 flex h-[240px] items-end justify-center overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.14),rgba(0,0,0,0.04)_45%,rgba(0,0,0,0.32)_100%)]">
        <div className="absolute inset-x-6 top-5 h-24 rounded-full blur-2xl opacity-70" style={{ backgroundColor: `${character.accent}55` }} />
        <div className="absolute top-6 z-20 h-24 w-24 overflow-hidden rounded-full border-4 border-white/20 bg-black/40 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
          {faceUrl
            ? <img src={faceUrl} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-white/30">NO FACE</div>}
        </div>
        <div className="absolute bottom-0 z-10 h-[145px] w-[132px] rounded-t-[42px] border border-white/8" style={{ backgroundColor: character.color }} />
        <div className="absolute bottom-[84px] z-20 h-14 w-[158px] rounded-[999px] border border-white/12 bg-black/20 blur-[1px]" />
        <div className="absolute bottom-0 z-20 h-[120px] w-[56px] rounded-t-[20px] bg-black/18" />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-lg font-black tracking-wide text-white">{character.label}</div>
          <div className="mt-1 text-xs text-white/55">Your face stays fixed. Only outfit color changes.</div>
        </div>
        {selected && <span className="text-xs font-black tracking-[0.2em] text-yellow-300 uppercase">Ready</span>}
      </div>
    </button>
  )
}

export default function CharacterSelect({ roomCode, playerFaceUrl, onConfirm, onBothSelected }) {
  const [selected, setSelected] = useState('blue')
  const [phase, setPhase] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef(null)

  useEffect(() => () => clearInterval(pollRef.current), [])

  function startPolling() {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const status = await getRoomStatus(roomCode)
        if (status.both_characters_selected) {
          clearInterval(pollRef.current)
          onBothSelected()
        }
      } catch (err) {
        clearInterval(pollRef.current)
        setPhase('idle')
        setErrorMsg(err.message || 'Failed to wait for opponent')
      }
    }, 1200)
  }

  async function handleConfirm() {
    if (!selected || phase === 'submitting' || phase === 'waiting') return
    setPhase('submitting')
    setErrorMsg('')
    try {
      const result = await onConfirm(selected)
      if (result?.both_characters_selected) {
        onBothSelected()
        return
      }
      setPhase('waiting')
      startPolling()
    } catch (err) {
      setPhase('idle')
      setErrorMsg(err.message || 'Failed to start game')
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden select-none">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${backgroundImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-black/60" />

      {/* Title */}
      <div className="relative z-10 pt-8 pb-4 text-center">
        <h1 className="text-3xl font-black text-white tracking-wide">SELECT YOUR FIGHTER</h1>
        <p className="text-sm text-gray-400 mt-2">Choose a character to fight with</p>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1080px] flex-1 flex-wrap items-center justify-center gap-5 px-8 py-8">
        {CHARACTERS.map(char => (
          <FighterCard
            key={char.key}
            character={char}
            selected={selected === char.key}
            faceUrl={playerFaceUrl}
            onClick={() => setSelected(char.key)}
          />
        ))}
      </div>

      {/* Start Game button */}
      <div className="relative z-10 flex flex-col items-center gap-3 pb-8">
        {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
        {phase === 'waiting' && (
          <p className="text-sm text-gray-300">Waiting for opponent to press Start Game...</p>
        )}
        <Button
          onClick={handleConfirm}
          disabled={!selected || phase === 'submitting' || phase === 'waiting'}
          className="px-12 py-3 text-lg"
        >
          {phase === 'submitting' ? 'Starting...' : phase === 'waiting' ? 'Waiting...' : 'Start Game'}
        </Button>
      </div>
    </div>
  )
}
