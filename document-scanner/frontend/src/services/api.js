import ENV from "../config/env"

export async function scanDocument(imageDataUrl) {
  const base64 = imageDataUrl.split(",")[1]
  const body = { image_base64: base64 }
  const res = await fetch(`${ENV.API_BASE_URL}/api/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || "Scan failed")
  }
  const json = await res.json()
  return json
}
