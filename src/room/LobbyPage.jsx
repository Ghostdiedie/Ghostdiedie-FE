import Button from '../components/Button'
import backgroundImg from '../assets/background/background.webp'
import logoImg from '../assets/background/logo.webp'

export default function LobbyPage({ onCreateGame, onJoinGame, onBack }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden select-none"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-150 text-sm font-medium tracking-wide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Content: Logo left + Buttons right */}
      <div className="relative z-10 flex items-center gap-12 px-8 max-w-[1040px] w-full">

        {/* Logo */}
        <div className="animate-slide-to-left shrink-0 flex-1 flex justify-center">
          <img
            src={logoImg}
            alt="Ghost Die Die"
            className="w-[clamp(260px,34vw,500px)] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
          />
        </div>

        {/* Button panel */}
        <div className="animate-fade-in-right flex-1 flex justify-center">
          <div className="flex flex-col items-center bg-black/60 backdrop-blur-xl border border-white/20 rounded-[28px] px-10 py-10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] w-[360px]">
            <div className="flex flex-col gap-3 w-full">
              <Button onClick={onCreateGame} className="w-full justify-center">
                Create Game
              </Button>
              <Button onClick={onJoinGame} className="w-full justify-center">
                Join Game
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
