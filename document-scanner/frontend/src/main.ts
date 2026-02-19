import "./styles/global.css";
import { scanDocument, checkBackendHealth } from "./services/apiClient";
import { downloadBase64Pdf } from "./utils/download";

type ScanPhase =
  | "idle"
  | "align"
  | "holding"
  | "ready"
  | "capturing"
  | "processing"
  | "done"
  | "error";

type WorkerMetrics = {
  hasContour: boolean;
  aligned: boolean;
  stabilityScore: number;
  movementVariance: number;
  alignmentConfidence: number;
  aspectRatio: number;
  frameCoverage: number;
};

const ANALYSIS_INTERVAL_MS = 70;
const READY_THRESHOLD = 0.75;
const STABLE_THRESHOLD = 0.65;
const ALIGNMENT_CONFIDENCE_GOOD = 0.75;
const MAX_CAPTURE_DIMENSION = 1500;
const CAPTURE_QUALITY = 0.82;

const video = document.getElementById("camera-video") as HTMLVideoElement | null;
const analysisCanvas = document.getElementById(
  "analysis-canvas"
) as HTMLCanvasElement | null;
const overlayFrame = document.getElementById("overlay-frame") as HTMLDivElement | null;
const startButton = document.getElementById("start-button") as HTMLButtonElement | null;
const captureButton = document.getElementById(
  "capture-button"
) as HTMLButtonElement | null;
const orientationButton = document.getElementById(
  "orientation-button"
) as HTMLButtonElement | null;
const statusBanner = document.getElementById("status-banner") as HTMLDivElement | null;
const statusLabel = document.getElementById("status-label") as HTMLSpanElement | null;
const metricAligned = document.getElementById(
  "metric-aligned"
) as HTMLSpanElement | null;
const metricStability = document.getElementById(
  "metric-stability"
) as HTMLSpanElement | null;
const metricMovement = document.getElementById(
  "metric-movement"
) as HTMLSpanElement | null;
const alignmentMessageEl = document.getElementById(
  "alignment-message"
) as HTMLDivElement | null;
const resultsSection = document.getElementById("results-section") as HTMLElement | null;
const resultsTitle = document.getElementById("results-title") as HTMLHeadingElement | null;
const resultsBody = document.getElementById("results-body") as HTMLDivElement | null;

let phase: ScanPhase = "idle";
let orientation: "portrait" | "landscape" = "portrait";
let metrics: WorkerMetrics | null = null;
let stream: MediaStream | null = null;
let worker: Worker | null = null;
let frameLoopHandle: number | null = null;
let lastAnalysisTime = 0;
let stableStart: number | null = null;

function setPhase(next: ScanPhase, label: string) {
  phase = next;
  if (statusLabel) {
    statusLabel.textContent = label;
  }
  if (!statusBanner) return;
  statusBanner.classList.remove("status-neutral", "status-ready", "status-warn", "status-error");
  if (phase === "ready") {
    statusBanner.classList.add("status-banner", "status-ready");
  } else if (phase === "holding" || phase === "processing" || phase === "capturing") {
    statusBanner.classList.add("status-banner", "status-warn");
  } else if (phase === "error") {
    statusBanner.classList.add("status-banner", "status-error");
  } else {
    statusBanner.classList.add("status-banner", "status-neutral");
  }
}

function setAlignmentMessage(text: string) {
  if (alignmentMessageEl) {
    alignmentMessageEl.textContent = text;
  }
}

function setReadyHint(enabled: boolean) {
  if (!captureButton) return;
  if (enabled) {
    captureButton.classList.add("capture-ready");
  } else {
    captureButton.classList.remove("capture-ready");
  }
}

function updateMetricsDisplay(values: WorkerMetrics) {
  if (metricAligned) {
    metricAligned.textContent = values.aligned ? "Yes" : "No";
  }
  if (metricStability) {
    metricStability.textContent = values.stabilityScore.toFixed(2);
  }
  if (metricMovement) {
    metricMovement.textContent = values.movementVariance.toFixed(2);
  }
}

function ensureWorker() {
  if (worker) return;
  worker = new Worker(new URL("./workers/opencvWorker.ts", import.meta.url), {
    type: "classic"
  });
  worker.onmessage = event => {
    const data = event.data as WorkerMetrics;
    metrics = data;
    updateMetricsDisplay(data);

    const { hasContour, aligned, stabilityScore, alignmentConfidence, frameCoverage } =
      data;

    const now = performance.now();
    const isStable = stabilityScore >= STABLE_THRESHOLD && aligned && hasContour;

    if (isStable) {
      if (stableStart == null) {
        stableStart = now;
      }
      const stableFor = now - stableStart;
      if (stableFor > 800 && stabilityScore >= READY_THRESHOLD) {
        setPhase("ready", "Ready to scan");
        setAlignmentMessage("Ready to scan");
        setReadyHint(true);
      } else {
        setPhase("holding", "Hold steady…");
        setAlignmentMessage("Hold steady…");
        setReadyHint(false);
      }
    } else {
      stableStart = null;
      setReadyHint(false);
      if (!hasContour) {
        setPhase("align", "Align document");
        setAlignmentMessage("Point camera at document");
      } else if (frameCoverage > 0.7) {
        setPhase("holding", "Hold steady…");
        setAlignmentMessage("Hold steady");
      } else if (alignmentConfidence < ALIGNMENT_CONFIDENCE_GOOD) {
        setPhase("align", "Align document");
        setAlignmentMessage("Move slightly closer");
      } else {
        setPhase("holding", "Hold steady…");
        setAlignmentMessage("Hold steady…");
      }
    }
  };
}

function stopFrameLoop() {
  if (frameLoopHandle != null) {
    cancelAnimationFrame(frameLoopHandle);
    frameLoopHandle = null;
  }
}

function stopCamera() {
  stopFrameLoop();
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  stableStart = null;
}

async function startCamera() {
  if (!video || !analysisCanvas) return;
  try {
    ensureWorker();
    const s = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    stream = s;
    video.srcObject = s;
    await video.play();

    setPhase("align", "Align document");
    setAlignmentMessage("Place the document inside the frame");

    if (startButton) {
      startButton.disabled = true;
    }
    if (captureButton) {
      captureButton.disabled = false;
    }
    if (orientationButton) {
      orientationButton.disabled = false;
    }

    const loop = () => {
      frameLoopHandle = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - lastAnalysisTime < ANALYSIS_INTERVAL_MS) {
        return;
      }
      lastAnalysisTime = now;
      if (!analysisCanvas || !video.videoWidth || !video.videoHeight) {
        return;
      }
      analysisCanvas.width = video.videoWidth;
      analysisCanvas.height = video.videoHeight;
      const context = analysisCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
      const frame = context.getImageData(
        0,
        0,
        analysisCanvas.width,
        analysisCanvas.height
      );
      if (worker) {
        worker.postMessage({ imageData: frame });
      }
    };

    stopFrameLoop();
    loop();
  } catch (error) {
    stopCamera();
    setPhase("error", "Unable to start camera");
    if (resultsTitle && resultsBody) {
      resultsTitle.textContent = "Scan error";
      resultsBody.innerHTML =
        "<p class=\"error-text\">Camera access failed. Check permissions and try again.</p>";
    }
    throw error;
  }
}

async function captureFrame(): Promise<string | null> {
  if (!video || !video.videoWidth || !video.videoHeight) {
    return null;
  }
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  const scale = Math.min(MAX_CAPTURE_DIMENSION / Math.max(srcW, srcH), 1.0);
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", CAPTURE_QUALITY);
  const parts = dataUrl.split("base64,");
  if (parts.length !== 2) return null;
  return parts[1];
}

function setResultsIdle() {
  if (!resultsTitle || !resultsBody) return;
  resultsTitle.textContent = "Scan results";
  resultsBody.innerHTML = "<p>Scan a document to see extracted fields and text.</p>";
}

function showError(message: string) {
  setPhase("error", "Scan failed");
  if (!resultsTitle || !resultsBody) return;
  resultsTitle.textContent = "Scan error";
  resultsBody.innerHTML =
    `<p class="error-text">${message}</p>` +
    '<p class="hint-text">If this keeps happening, check that the backend URL is reachable and environment variables are set.</p>' +
    '<button id="retry-button" type="button" class="primary">Try again</button>';
  const retryButton = document.getElementById("retry-button") as HTMLButtonElement | null;
  if (retryButton) {
    retryButton.onclick = () => {
      setResultsIdle();
      setPhase("align", "Align document");
    };
  }
}

function showResult(payload: {
  text: string;
  fields: Record<string, unknown>;
  pdfBase64: string;
  capturedImageBase64: string;
}) {
  setPhase("done", "Scan complete");
  if (!resultsTitle || !resultsBody) return;
  resultsTitle.textContent = "Scan results";

  const fieldEntries = Object.entries(payload.fields).filter(
    ([, value]) => value != null && value !== "" && !(Array.isArray(value) && value.length === 0)
  );

  const fieldsHtml =
    fieldEntries.length === 0
      ? "<p>No structured fields detected.</p>"
      : fieldEntries
          .map(([key, value]) => {
            const val =
              typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
            return `<div class="field-row"><dt>${key}</dt><dd>${val}</dd></div>`;
          })
          .join("");

  const debugPreview = payload.capturedImageBase64
    ? `<h2>Debug preview</h2>
       <div class="debug-preview">
         <div>
           <p>Captured image</p>
           <img src="data:image/jpeg;base64,${payload.capturedImageBase64}" alt="Captured document" />
         </div>
       </div>`
    : "";

  resultsBody.innerHTML =
    `<h2>Extracted fields</h2>
     <dl class="field-list">${fieldsHtml}</dl>
     ${debugPreview}
     <h2>Raw OCR text</h2>
     <pre class="text-block">${payload.text}</pre>
     <div class="results-actions">
       <button id="download-pdf" type="button" class="primary">Download PDF</button>
       <button id="new-scan" type="button">New scan</button>
     </div>`;

  const downloadBtn = document.getElementById("download-pdf") as HTMLButtonElement | null;
  if (downloadBtn) {
    downloadBtn.onclick = () => downloadBase64Pdf(payload.pdfBase64);
  }
  const newScanBtn = document.getElementById("new-scan") as HTMLButtonElement | null;
  if (newScanBtn) {
    newScanBtn.onclick = () => {
      setResultsIdle();
      setPhase("align", "Align document");
    };
  }
}

async function handleCapture() {
  if (!captureButton) return;
  captureButton.disabled = true;
  setReadyHint(false);
  setPhase("capturing", "Capturing document");
  try {
    const healthy = await checkBackendHealth();
    if (!healthy) {
      setPhase("processing", "Contacting server…");
    }
    const base64 = await captureFrame();
    if (!base64) {
      showError("Failed to capture frame from camera.");
      return;
    }
    setPhase("processing", "Processing document on secure server");
    setResultsIdle();
    const response = await scanDocument(base64);
    showResult({
      text: response.text,
      fields: response.fields as Record<string, unknown>,
      pdfBase64: response.pdf_base64,
      capturedImageBase64: base64
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while processing scan.";
    showError(message);
  } finally {
    if (captureButton) {
      captureButton.disabled = false;
    }
  }
}

function toggleOrientation() {
  orientation = orientation === "portrait" ? "landscape" : "portrait";
  if (overlayFrame) {
    overlayFrame.classList.remove("overlay-portrait", "overlay-landscape");
    overlayFrame.classList.add(
      "overlay-frame",
      orientation === "portrait" ? "overlay-portrait" : "overlay-landscape"
    );
  }
  if (orientationButton) {
    orientationButton.textContent =
      orientation === "portrait" ? "Portrait frame" : "Landscape frame";
  }
}

function wireEvents() {
  setPhase("idle", "Start camera to scan a document");
  setResultsIdle();
  if (startButton) {
    startButton.onclick = () => {
      startCamera().catch(() => undefined);
    };
  }
  if (captureButton) {
    captureButton.onclick = () => {
      handleCapture().catch(() => undefined);
    };
  }
  if (orientationButton) {
    orientationButton.onclick = () => {
      toggleOrientation();
    };
  }
  if (overlayFrame) {
    overlayFrame.classList.add("overlay-portrait");
  }
}

wireEvents();
