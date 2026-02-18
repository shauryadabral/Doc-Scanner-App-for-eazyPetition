function ScannerOverlay({ corners }) {
  if (!corners) {
    return <div className="scanner-overlay" />
  }
  const path = corners
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x * 100} ${p.y * 100}`)
    .join(" ") + " Z"

  return (
    <div className="scanner-overlay">
      <svg className="scanner-overlay-svg" viewBox="0 0 100 100">
        <path d={path} className="scanner-overlay-path" />
      </svg>
    </div>
  )
}

export default ScannerOverlay
