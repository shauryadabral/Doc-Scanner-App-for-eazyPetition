import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanPhase } from "../App";

type WorkerMetrics = {
  aligned: boolean;
  stabilityScore: number;
  movementVariance: number;
};

type UseCameraResult = {
  videoRef: React.RefObject<HTMLVideoElement>;
  analysisCanvasRef: React.RefObject<HTMLCanvasElement>;
  canCapture: boolean;
  metrics: WorkerMetrics | null;
  phase: ScanPhase;
  start: () => Promise<void>;
  stop: () => void;
  captureFullResolution: () => Promise<string | null>;
  setPhaseExternally: (phase: ScanPhase, label: string) => void;
  phaseLabel: string;
};

const MOVEMENT_THRESHOLD = 3.5;
const STABLE_DURATION_MS = 3000;
const ANALYSIS_INTERVAL_MS = 120;

export function useCamera(initialPhase: ScanPhase): UseCameraResult {
  const [phase, setPhase] = useState<ScanPhase>(initialPhase);
  const [phaseLabel, setPhaseLabel] = useState("Start camera to scan a document");
  const [canCapture, setCanCapture] = useState(false);
  const [metrics, setMetrics] = useState<WorkerMetrics | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const frameLoopRef = useRef<number | null>(null);
  const lastAnalysisTimeRef = useRef<number>(0);
  const stableStartRef = useRef<number | null>(null);

  const setPhaseExternally = useCallback((next: ScanPhase, label: string) => {
    setPhase(next);
    setPhaseLabel(label);
  }, []);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/opencvWorker.ts", import.meta.url),
      { type: "classic" }
    );
    workerRef.current = worker;

    worker.onmessage = event => {
      const data = event.data as WorkerMetrics;
      setMetrics(data);

      const now = performance.now();
      const underMovement = data.movementVariance < MOVEMENT_THRESHOLD;
      const isStableFrame = data.aligned && underMovement;

      if (isStableFrame) {
        if (stableStartRef.current == null) {
          stableStartRef.current = now;
        }
        const stableFor = now - stableStartRef.current;
        if (stableFor >= STABLE_DURATION_MS) {
          if (!canCapture) {
            setCanCapture(true);
            setPhase("ready");
            setPhaseLabel("Ready to capture");
          }
        } else {
          setCanCapture(false);
          setPhase("holding");
          setPhaseLabel("Hold steady");
        }
      } else {
        stableStartRef.current = null;
        setCanCapture(false);
        setPhase("align");
        setPhaseLabel("Align document");
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [canCapture]);

  const stopFrameLoop = () => {
    if (frameLoopRef.current != null) {
      cancelAnimationFrame(frameLoopRef.current);
      frameLoopRef.current = null;
    }
  };

  const stop = useCallback(() => {
    stopFrameLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCanCapture(false);
    stableStartRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Video element not available");
      }
      video.srcObject = stream;
      await video.play();

      setPhase("align");
      setPhaseLabel("Align document");

      const loop = () => {
        frameLoopRef.current = requestAnimationFrame(loop);
        const now = performance.now();
        if (now - lastAnalysisTimeRef.current < ANALYSIS_INTERVAL_MS) {
          return;
        }
        lastAnalysisTimeRef.current = now;

        const canvas = analysisCanvasRef.current;
        if (!canvas || !video.videoWidth || !video.videoHeight) {
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        if (workerRef.current) {
          workerRef.current.postMessage({ imageData: frame });
        }
      };

      stopFrameLoop();
      loop();
    } catch (error) {
      stop();
      throw error;
    }
  }, [stop]);

  const captureFullResolution = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const [, base64] = dataUrl.split("base64,");
    if (!base64) {
      return null;
    }
    return base64;
  }, []);

  return {
    videoRef,
    analysisCanvasRef,
    canCapture,
    metrics,
    phase,
    start,
    stop,
    captureFullResolution,
    setPhaseExternally,
    phaseLabel
  };
}
