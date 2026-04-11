import Button from '../components/Button'
import backgroundImg from '../assets/background/background.webp'
import logoImg from '../assets/background/logo.webp'

export default function LandingPage({ onStart }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Logo */}
      <div className="relative z-10 animate-fade-in-up">
        <img
          src={logoImg}
          alt="Ghost Die Die"
          className="w-[clamp(340px,62vw,720px)] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        />
      </div>

      {/* Start button */}
      <div className="relative z-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <Button onClick={onStart} className="px-16 text-base tracking-[0.2em]">
          START
        </Button>
      </div>
    </div>
  )
}
