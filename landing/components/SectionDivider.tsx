export function SectionDivider({ from = "dark" }: { from?: "dark" | "light" }) {
  const isDtL = from === "dark"

  return (
    <div
      style={{
        height: 200,
        background: isDtL
          ? "linear-gradient(to bottom, #030303 0%, #f5f5f5 100%)"
          : "linear-gradient(to bottom, #f5f5f5 0%, #030303 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dot overlay — visible on the dark portion, masked out toward the light */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: isDtL
            ? "radial-gradient(circle, rgba(180,180,180,0.35) 1px, transparent 1px)"
            : "radial-gradient(circle, rgba(30,30,30,0.25) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
          WebkitMaskImage: isDtL
            ? "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 72%)"
            : "linear-gradient(to bottom, rgba(0,0,0,0) 28%, rgba(0,0,0,1) 100%)",
          maskImage: isDtL
            ? "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 72%)"
            : "linear-gradient(to bottom, rgba(0,0,0,0) 28%, rgba(0,0,0,1) 100%)",
        }}
      />
    </div>
  )
}
