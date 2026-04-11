export default function Button({ children, onClick, disabled = false, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2',
        'h-14 px-10 rounded-full',
        'bg-neutral-900 text-white',
        'border border-black/60',
        'shadow-lg',
        'font-semibold text-sm tracking-wide whitespace-nowrap',
        'hover:bg-neutral-800',
        'active:bg-neutral-950',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        'transition-colors duration-150',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
