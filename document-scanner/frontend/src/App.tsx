import { useState } from "react";
import { Layout } from "./components/Layout";
import { CameraView } from "./components/CameraView";
import { ScanStatusBanner } from "./components/ScanStatusBanner";
import { ResultsView } from "./components/ResultsView";
import { scanDocument } from "./services/apiClient";

export type ScanPhase =
  | "idle"
  | "align"
  | "holding"
  | "ready"
  | "capturing"
  | "processing"
  | "done"
  | "error";

export type ScanResult = {
  text: string;
  fields: Record<string, unknown>;
  pdfBase64: string;
  capturedImageBase64: string | null;
};

function App() {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [message, setMessage] = useState("Start camera to scan a document");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);

  const handlePhaseChange = (next: ScanPhase, label: string) => {
    setPhase(next);
    setMessage(label);
  };

  const handleCapture = async (imageBase64: string) => {
    setError(null);
    setResult(null);
    setLastCapturedImage(imageBase64);
    setPhase("processing");
    setMessage("Processing document on secure server");
    try {
      const response = await scanDocument(imageBase64);
      setResult({
        text: response.text,
        fields: response.fields,
        pdfBase64: response.pdf_base64,
        capturedImageBase64: imageBase64
      });
      setPhase("done");
      setMessage("Scan complete");
    } catch (err) {
      setPhase("error");
      setMessage("Scan failed");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setPhase("idle");
    setMessage("Start camera to scan a document");
  };

  return (
    <Layout>
      <ScanStatusBanner phase={phase} message={message} />
      <div className="app-grid">
        <div className="pane">
          <CameraView
            phase={phase}
            onPhaseChange={handlePhaseChange}
            onCapture={handleCapture}
          />
        </div>
        <div className="pane">
          <ResultsView result={result} error={error} onReset={handleReset} />
        </div>
      </div>
    </Layout>
  );
}

export default App;
