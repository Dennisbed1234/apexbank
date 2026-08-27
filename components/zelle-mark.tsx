export function ZelleMark({
  className,
  showWord = true,
}: {
  className?: string
  showWord?: boolean
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className || ''}`}>
      <svg
        viewBox="0 0 32 32"
        className="size-6 shrink-0"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="#6C1CD3" />
        <path
          d="M9 9.2h14v3.1L14.6 22.8H23V26H9v-3.1l8.4-10.5H9V9.2z"
          fill="#fff"
        />
      </svg>
      {showWord && (
        <span className="text-sm font-semibold tracking-tight text-[#6C1CD3]">
          Zelle
          <sup className="text-[9px]">&reg;</sup>
        </span>
      )}
    </span>
  )
}
