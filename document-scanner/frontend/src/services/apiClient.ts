import { API_BASE_URL, SCAN_ENDPOINT } from "../config/api";

type ScanResponse = {
  text: string;
  words: unknown[];
  fields: Record<string, unknown>;
  pdf_base64: string;
};

export async function scanDocument(imageBase64: string): Promise<ScanResponse> {
  const payload = {
    image_base64: imageBase64
  };

  const response = await fetch(`${API_BASE_URL}${SCAN_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message);
  }

  return response.json();
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data.detail === "string") {
      return data.detail;
    }
  } catch {}
  return `Request failed with status ${response.status}`;
}
