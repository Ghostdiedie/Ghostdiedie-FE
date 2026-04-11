import Button from '../components/Button'

export default function LandingPage({ onStart }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-100 flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* Background blobs — give backdrop-blur something to blur */}
      <div className="absolute top-[-80px] left-[-80px] w-[420px] h-[420px] rounded-full bg-rose-300/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-60px] right-[-60px] w-[360px] h-[360px] rounded-full bg-orange-300/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-red-100/40 blur-3xl pointer-events-none" />

      {/* Title */}
      <div className="relative z-10 text-center mb-14 leading-none">
        <div className="font-black tracking-[0.08em] text-gray-900 text-[clamp(4.5rem,14vw,9rem)]">
          GHOST
        </div>
        <div className="font-black tracking-[0.08em] text-red-500 text-[clamp(4.5rem,14vw,9rem)]">
          DIEDIE
        </div>
      </div>

      {/* Start button */}
      <div className="relative z-10">
        <Button onClick={onStart} className="px-16 text-base tracking-[0.2em]">
          START
        </Button>
      </div>

      {/* Decorative rule */}
      <div className="absolute bottom-10 flex items-center gap-3 opacity-30">
        <div className="w-12 h-px bg-gray-400" />
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-12 h-px bg-gray-400" />
      </div>
    </div>
  )
}
