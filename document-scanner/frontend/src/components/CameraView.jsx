import { useEffect } from "react"
import { useCamera } from "../hooks/useCamera"
import { useFrameAnalysis } from "../hooks/useFrameAnalysis"
import { useStability } from "../hooks/useStability"
import ScannerOverlay from "./ScannerOverlay"
import StabilityIndicator from "./StabilityIndicator"

function CameraView({ onCapture }) {
  const { videoRef, isReady, error, startCamera } = useCamera()
  const { analysis, processCapture } = useFrameAnalysis(videoRef)
  const stability = useStability(
    analysis.aligned,
    analysis.stabilityScore,
    analysis.movementVariance
  )

  useEffect(() => {
    startCamera()
  }, [startCamera])

  const handleCapture = async () => {
    if (!stability.isReady) return
    const result = await processCapture()
    if (!result) return
    onCapture(result.imageData)
  }

  const disabled = !stability.isReady || !isReady || !!error

  return (
    <div className="camera-container">
      <div className="video-wrapper">
        <video
          ref={videoRef}
          playsInline
          className="camera-video"
          muted
        />
        <ScannerOverlay corners={analysis.corners} />
        <StabilityIndicator state={stability.state} />
      </div>
      <button
        className="capture-button"
        onClick={handleCapture}
        disabled={disabled}
      >
        Capture
      </button>
    </div>
  )
}

export default CameraView
