const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const getForecast = (date, cutoffHour) =>
  get("/api/forecast", { date, cutoff_hour: cutoffHour });

export const getAccuracy = (start, end, cutoffHour) =>
  get("/api/accuracy", { start, end, cutoff_hour: cutoffHour });