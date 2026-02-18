import StructuredFields from "./StructuredFields"

function ResultsPanel({ text, fields }) {
  if (!text && !fields) {
    return (
      <div className="results-panel empty">
        No results yet
      </div>
    )
  }
  return (
    <div className="results-panel">
      <StructuredFields fields={fields} />
      <div className="ocr-results">
        <div className="ocr-results-title">Raw OCR Text</div>
        <pre className="ocr-results-body">{text}</pre>
      </div>
    </div>
  )
}

export default ResultsPanel
