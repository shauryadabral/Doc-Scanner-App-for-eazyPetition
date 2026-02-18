const defaultBaseUrl = "http://localhost:8000";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || defaultBaseUrl;

export const SCAN_ENDPOINT = "/api/scan";
