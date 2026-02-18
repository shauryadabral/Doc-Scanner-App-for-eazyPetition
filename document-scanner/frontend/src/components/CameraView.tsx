import { useEffect, useRef, useState } from "react";
import type { ScanPhase } from "../App";
import { useCamera } from "../hooks/useCamera";

type Props = {
  phase: ScanPhase;
  onPhaseChange: (phase: ScanPhase, label: string) => void;
  onCapture: (imageBase64: string) => void;
};

export function CameraView({ onCapture, onPhaseChange }: Props) {
  const [starting, setStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const lastExternalPhase = useRef<ScanPhase>("idle");

  const {
    videoRef,
    analysisCanvasRef,
    metrics,
    alignmentMessage,
    isReadyHint,
    overlayOrientation,
    start,
    stop,
    captureFullResolution,
    phase,
    phaseLabel
  } = useCamera("idle");

  useEffect(() => {
    if (phase !== lastExternalPhase.current || phaseLabel) {
      lastExternalPhase.current = phase;
      onPhaseChange(phase, phaseLabel);
    }
  }, [phase, phaseLabel, onPhaseChange]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const handleStart = async () => {
    if (starting || hasStarted) return;
    try {
      setStarting(true);
      await start();
      setHasStarted(true);
    } finally {
      setStarting(false);
    }
  };

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const base64 = await captureFullResolution();
      if (base64) {
        onPhaseChange("capturing", "Capturing document");
        await onCapture(base64);
      }
    } finally {
      setCapturing(false);
    }
  };

  const aligned = metrics?.aligned ?? false;
  const stabilityScore = metrics?.stabilityScore ?? 0;
  const movement = metrics?.movementVariance ?? 0;

  const overlayClass =
    overlayOrientation === "portrait"
      ? "overlay-frame overlay-portrait"
      : "overlay-frame overlay-landscape";

  const captureClass = isReadyHint ? "primary capture-ready" : "primary";

  return (
    <section className="camera-section">
      <div className="camera-header">
        <h2>Live camera</h2>
        <p>Place the document inside the frame and hold steady.</p>
      </div>
      <div className="camera-wrapper">
        <div className="camera-frame">
          <video ref={videoRef} className="camera-video" playsInline muted />
          <canvas
            ref={analysisCanvasRef}
            className="camera-analysis-canvas"
            aria-hidden="true"
          />
          <div className={overlayClass} />
        </div>
      </div>
      <div className="camera-footer">
        <div className="metrics">
          <span>Aligned: {aligned ? "Yes" : "No"}</span>
          <span>Stability: {stabilityScore.toFixed(2)}</span>
          <span>Movement: {movement.toFixed(2)}</span>
        </div>
        <div className="alignment-message">{alignmentMessage}</div>
        <div className="camera-actions">
          {!hasStarted && (
            <button
              type="button"
              className="primary"
              onClick={handleStart}
              disabled={starting}
            >
              {starting ? "Starting..." : "Start camera"}
            </button>
          )}
          {hasStarted && (
            <button
              type="button"
              className={captureClass}
              onClick={handleCapture}
              disabled={capturing}
            >
              {capturing ? "Capturing..." : "Capture"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
