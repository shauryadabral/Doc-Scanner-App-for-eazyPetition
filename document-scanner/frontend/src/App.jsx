import { useState } from "react"
import CameraView from "./components/CameraView"
import ResultsPanel from "./components/ResultsPanel"
import PdfDownloadButton from "./components/PdfDownloadButton"
import ControlPanel from "./components/ControlPanel"
import { scanDocument } from "./services/api"
import {
  dataUrlFromImageData,
  resizeImageDataToMaxDimension
} from "./utils/imageUtils"
import { MAX_UPLOAD_DIMENSION } from "./utils/constants"
import "./styles/scanner.css"

function App() {
  const [ocrText, setOcrText] = useState("")
  const [fields, setFields] = useState(null)
  const [pdfBase64, setPdfBase64] = useState("")
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState("")

  const handleCapture = async imageData => {
    setIsBusy(true)
    setError("")
    try {
      const resized = resizeImageDataToMaxDimension(
        imageData,
        MAX_UPLOAD_DIMENSION
      )
      const dataUrl = dataUrlFromImageData(resized)
      const result = await scanDocument(dataUrl)
      setOcrText(result.text)
      setFields(result.fields)
      setPdfBase64(result.pdf_base64)
    } catch (e) {
      setError(e.message || "Scan failed")
      setOcrText("")
      setFields(null)
      setPdfBase64("")
    } finally {
      setIsBusy(false)
    }
  }

  const handleRescan = () => {
    setOcrText("")
    setFields(null)
    setPdfBase64("")
    setError("")
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Document Scanner</h1>
        <p>Near-native quality, CPU-only, privacy-first</p>
      </header>
      <main className="app-main">
        <section className="left-panel">
          <CameraView onCapture={handleCapture} />
          <ControlPanel isBusy={isBusy} onRescan={handleRescan} />
          {error && <div className="error-banner">{error}</div>}
        </section>
        <section className="right-panel">
          <ResultsPanel text={ocrText} fields={fields} />
          <PdfDownloadButton pdfBase64={pdfBase64} />
        </section>
      </main>
    </div>
  )
}

export default App
