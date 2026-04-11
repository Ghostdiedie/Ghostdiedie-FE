export default function Button({ children, onClick, disabled = false, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2',
        'h-14 px-10 rounded-full',
        'bg-white text-gray-900',
        'border border-white/80',
        'shadow-lg',
        'font-bold text-base tracking-wide whitespace-nowrap',
        'hover:bg-gray-100',
        'active:bg-gray-200',
        'focus:outline-none',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'transition-colors duration-150',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
