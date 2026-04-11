import { useEffect, useState } from 'react'

const SEQUENCE = [5, 4, 3, 2, 1, 'FIGHT!']

export default function Countdown({ onComplete }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (step >= SEQUENCE.length) {
      onComplete()
      return
    }

    const isFight = SEQUENCE[step] === 'FIGHT!'
    const showFor  = isFight ? 900 : 650
    const totalFor = isFight ? 1400 : 1000

    const t1 = setTimeout(() => setVisible(false), showFor)
    const t2 = setTimeout(() => {
      setStep(s => s + 1)
      setVisible(true)
    }, totalFor)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onComplete, step])

  if (step >= SEQUENCE.length) return null

  const current = SEQUENCE[step]
  const isFight = current === 'FIGHT!'

  return (
    <div className="fixed inset-0 bg-linear-to-br from-orange-50 via-white to-rose-100 flex items-center justify-center z-50 select-none">

      {/* Background blobs */}
      <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-rose-300/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-60px] right-[-60px] w-[340px] h-[340px] rounded-full bg-orange-300/30 blur-3xl pointer-events-none" />

      <div
        className={[
          'relative z-10 transition-[opacity,transform] duration-220 ease-out',
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.3]',
        ].join(' ')}
      >
        {isFight ? (
          <span className="font-black tracking-[0.05em] text-red-500 text-[clamp(4rem,12vw,7rem)]">
            FIGHT!
          </span>
        ) : (
          <span className="font-black text-gray-900 text-[clamp(10rem,28vw,18rem)] leading-none">
            {current}
          </span>
        )}
      </div>
    </div>
  )
}
