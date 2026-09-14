export function ApexLogo({
  className,
  compact,
}: {
  className?: string
  compact?: boolean
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/nicolet-logo.svg"
      alt="Nicolet National Bank"
      className={className || (compact ? 'h-8 w-auto' : 'h-10 w-auto')}
    />
  )
}
