function StabilityIndicator({ state }) {
  let label = "Align document"
  let className = "stability-indicator neutral"
  if (state === "align") {
    label = "Align document"
    className = "stability-indicator neutral"
  } else if (state === "hold") {
    label = "Hold steady"
    className = "stability-indicator warning"
  } else if (state === "ready") {
    label = "Ready to capture"
    className = "stability-indicator ok"
  }
  return <div className={className}>{label}</div>
}

export default StabilityIndicator
