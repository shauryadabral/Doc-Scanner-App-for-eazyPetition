import { API_BASE_URL, API_BASE_URLS, SCAN_ENDPOINT, SCAN_MULTIPART_ENDPOINT, SCAN_URL_ENDPOINT } from "../config/api";

type ScanResponse = {
  text: string;
  words: unknown[];
  fields: Record<string, unknown>;
  pdf_base64: string;
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function checkBackendHealth(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/health`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        keepalive: false,
      },
      4000
    );
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return typeof data === "object" && data && (data as any).status === "ok";
  } catch {
    return false;
  }
}

async function resolveAvailableBaseUrl(): Promise<string | null> {
  const candidates = (API_BASE_URLS && API_BASE_URLS.length > 0) ? API_BASE_URLS : (API_BASE_URL ? [API_BASE_URL] : []);
  for (const url of candidates) {
    const ok = await checkBackendHealth(url);
    if (ok) return url;
  }
  return candidates.length > 0 ? candidates[0] : null;
}

export async function scanDocument(imageBase64: string): Promise<ScanResponse> {
  const baseUrl = await resolveAvailableBaseUrl();
  if (!baseUrl) {
    throw new Error("Backend URL not configured. Set VITE_API_BASE_URL in your environment.");
  }

  const payload = {
    image_base64: imageBase64
  };

  const maxAttempts = 3;
  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}${SCAN_ENDPOINT}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          keepalive: false,
          mode: "cors",
        },
        30000
      );
      if (!response.ok) {
        const message = await safeReadError(response);
        if (response.status >= 500 && response.status < 600 && attempt < maxAttempts) {
          await delay(800 * attempt);
          continue;
        }
        throw new Error(message);
      }
      const data = await response.json();
      return data as ScanResponse;
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      const message =
        isAbort
          ? "Request timed out contacting OCR server."
          : "Network error: could not reach OCR server. Check API URL and connection.";
      lastError = e instanceof Error ? e : new Error(message);
      if (attempt < maxAttempts) {
        await delay(800 * attempt);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("Unknown error while contacting OCR server.");
}

export async function scanDocumentBinary(imageBlob: Blob): Promise<ScanResponse> {
  const baseUrl = await resolveAvailableBaseUrl();
  if (!baseUrl) throw new Error("Backend URL not configured.");
  const form = new FormData();
  form.append("file", imageBlob, "capture.jpg");
  const res = await fetchWithTimeout(
    `${baseUrl}${SCAN_MULTIPART_ENDPOINT}`,
    {
      method: "POST",
      body: form,
      cache: "no-store",
      keepalive: false,
      mode: "cors",
    },
    30000
  );
  if (!res.ok) {
    const message = await safeReadError(res);
    throw new Error(message);
  }
  return res.json();
}

export async function scanDocumentFromUrl(url: string): Promise<ScanResponse> {
  const baseUrl = await resolveAvailableBaseUrl();
  if (!baseUrl) throw new Error("Backend URL not configured.");
  const res = await fetchWithTimeout(
    `${baseUrl}${SCAN_URL_ENDPOINT}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      cache: "no-store",
      keepalive: false,
      mode: "cors",
    },
    30000
  );
  if (!res.ok) {
    const message = await safeReadError(res);
    throw new Error(message);
  }
  return res.json();
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
