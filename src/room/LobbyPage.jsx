import Button from '../components/Button'

export default function LobbyPage({ playerName, setPlayerName, onCreateGame, onJoinGame }) {
  const ready = playerName.trim().length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-100 flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* Background blobs */}
      <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-rose-300/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-60px] right-[-60px] w-[340px] h-[340px] rounded-full bg-orange-300/25 blur-3xl pointer-events-none" />

      {/* Glass card */}
      <div className="relative z-10 flex flex-col items-center bg-white/40 backdrop-blur-xl border border-white/70 rounded-[32px] px-12 py-12 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] w-[360px]">

        {/* Logo */}
        <div className="font-black tracking-[0.08em] text-gray-900 text-2xl leading-none mb-1">
          GHOST<span className="text-red-500">DIEDIE</span>
        </div>
        <div className="w-8 h-px bg-gray-300 mb-8" />

        {/* Name input */}
        <div className="w-full mb-8">
          <label className="block text-xs font-medium tracking-[0.15em] text-gray-400 uppercase mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter name..."
            maxLength={20}
            className="w-full h-11 rounded-[14px] bg-white/60 backdrop-blur-md border border-white/80 px-4 text-gray-900 font-medium placeholder-gray-300 focus:outline-none focus:border-red-300 focus:bg-white/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] transition-[border-color,background-color] duration-150"
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <Button onClick={onCreateGame} disabled={!ready} className="w-full justify-center">
            Create Game
          </Button>
          <Button onClick={onJoinGame} disabled={!ready} className="w-full justify-center">
            Join Game
          </Button>
        </div>

        {!ready && (
          <p className="mt-5 text-xs text-gray-400 tracking-wide">
            Enter your name to continue
          </p>
        )}
      </div>
    </div>
  )
}
