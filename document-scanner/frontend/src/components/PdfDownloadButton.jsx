function PdfDownloadButton({ pdfBase64 }) {
  const handleDownload = () => {
    if (!pdfBase64) return
    const byteCharacters = atob(pdfBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "scan.pdf"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      className="download-button"
      onClick={handleDownload}
      disabled={!pdfBase64}
    >
      Download PDF
    </button>
  )
}

export default PdfDownloadButton
