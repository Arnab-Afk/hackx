export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-sm font-semibold tracking-tight text-white select-none ${className}`}
      style={{ letterSpacing: "-0.01em" }}
    >
      COMPUT
      <span style={{ display: "inline-block", transform: "scaleX(-1)" }}>E</span>
    </span>
  )
}
