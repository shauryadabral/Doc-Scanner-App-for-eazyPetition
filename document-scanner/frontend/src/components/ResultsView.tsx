import { ScanResult } from "../App";
import { downloadBase64Pdf } from "../utils/download";

type Props = {
  result: ScanResult | null;
  error: string | null;
  onReset: () => void;
};

export function ResultsView({ result, error, onReset }: Props) {
  if (error) {
    return (
      <section className="results">
        <h2>Scan error</h2>
        <p className="error-text">{error}</p>
        <button type="button" className="primary" onClick={onReset}>
          Try again
        </button>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="results">
        <h2>Scan results</h2>
        <p>Scan a document to see extracted fields and text.</p>
      </section>
    );
  }

  const fields = result.fields as Record<string, unknown>;

  return (
    <section className="results">
      <h2>Extracted fields</h2>
      <dl className="field-list">
        {Object.keys(fields).length === 0 && (
          <p>No structured fields detected.</p>
        )}
        {Object.entries(fields).map(([key, value]) => {
          if (!value) return null;
          return (
            <div key={key} className="field-row">
              <dt>{key}</dt>
              <dd>
                {typeof value === "object"
                  ? JSON.stringify(value, null, 2)
                  : String(value)}
              </dd>
            </div>
          );
        })}
      </dl>
      <h2>Raw OCR text</h2>
      <pre className="text-block">{result.text}</pre>
      <div className="results-actions">
        <button
          type="button"
          className="primary"
          onClick={() => downloadBase64Pdf(result.pdfBase64)}
        >
          Download PDF
        </button>
        <button type="button" onClick={onReset}>
          New scan
        </button>
      </div>
    </section>
  );
}
