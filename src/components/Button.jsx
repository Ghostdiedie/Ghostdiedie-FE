export default function Button({ children, onClick, disabled = false, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        // Shape & size
        'h-12 px-8 rounded-[20px]',
        // Liquid glass base
        'bg-white/50 backdrop-blur-xl',
        'border border-white/70',
        // Glass shadow: outer depth + inner top highlight + inner bottom shadow
        'shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(0,0,0,0.06)]',
        // Typography
        'text-gray-800 font-semibold text-[15px] tracking-wide whitespace-nowrap',
        // Hover (no animation — only color change)
        'hover:bg-white/75',
        'hover:shadow-[0_4px_16px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(0,0,0,0.06)]',
        // Press
        'active:bg-white/35',
        // Disabled
        'disabled:opacity-40 disabled:cursor-not-allowed',
        // Transition only for bg + shadow (no transform/scale)
        'transition-[background-color,box-shadow] duration-150',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
