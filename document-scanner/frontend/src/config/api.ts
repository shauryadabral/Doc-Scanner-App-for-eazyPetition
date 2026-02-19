const envBaseUrl = "https://doc-scanner-app-for-eazypetition.onrender.com";//hardcoded for now, after sometime add env variable to the frontend deployment.
let resolvedBaseUrl = envBaseUrl;

if (!resolvedBaseUrl || resolvedBaseUrl.length === 0) {
  if (import.meta.env.DEV) {
    resolvedBaseUrl = "http://localhost:8000";
  } else {
    resolvedBaseUrl = "";
  }
}

if (
  typeof window !== "undefined" &&
  resolvedBaseUrl.includes("localhost") &&
  window.location.hostname !== "localhost"
) {
  // eslint-disable-next-line no-console
  console.warn(
    "VITE_API_BASE_URL points to localhost while running in production. Configure a public backend URL in your Pages environment variables."
  );
}

export const API_BASE_URL = resolvedBaseUrl;

export const SCAN_ENDPOINT = "/api/scan";
