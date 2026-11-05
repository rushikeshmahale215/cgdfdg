import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getForecast } from "../api.js";

const card = {
  flex: "1 1 180px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "14px 16px",
  background: "#fff",
};

function Card({ label, value, sub }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const fmtMW = (v) => (v == null ? "n/a" : `${Math.round(v).toLocaleString()} MW`);
const fmtMWh = (v) => (v == null ? "n/a" : `${Math.round(v).toLocaleString()} MWh`);
const hhmm = (iso) => iso.slice(11, 16);
const fmtStamp = (iso) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export default function ForecastPage() {
  const [date, setDate] = useState("2026-01-15");
  const [cutoffHour, setCutoffHour] = useState(9);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getForecast(date, cutoffHour)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, cutoffHour]);

  const stats = useMemo(() => {
    if (!data) return null;
    const pts = data.points;
    const withF = pts.filter((p) => p.forecast != null);
    const withA = pts.filter((p) => p.actual != null);
    const sum = (arr, k) => arr.reduce((s, p) => s + p[k], 0);

    const peak = withF.reduce((m, p) => (m == null || p.forecast > m.forecast ? p : m), null);
    const pubs = withF.map((p) => p.publishTime).filter(Boolean).sort();

    return {
      forecastMWh: withF.length ? sum(withF, "forecast") * 0.5 : null, // MW x 0.5h per slot
      actualMWh: withA.length ? sum(withA, "actual") * 0.5 : null,
      peak,
      missingForecast: 48 - withF.length,
      missingActual: 48 - withA.length,
      firstPub: pubs[0],
      lastPub: pubs[pubs.length - 1],
    };
  }, [data]);

  const chartData = useMemo(
    () => (data ? data.points.map((p) => ({ ...p, time: hhmm(p.startTime) })) : []),
    [data]
  );

  return (
    <section>
      <h3 style={{ marginTop: 0 }}>Day-ahead wind forecast</h3>
      <p style={{ color: "#4b5563", marginTop: -8 }}>
        Shows the latest forecast you would actually have had at decision time. Forecasts published
        after the cutoff are ignored.
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end", margin: "16px 0" }}>
        <label style={{ display: "flex", flexDirection: "column", fontSize: 13, gap: 4 }}>
          Delivery day
          <input
            type="date"
            value={date}
            min="2026-01-01"
            max="2026-01-31"
            onChange={(e) => e.target.value && setDate(e.target.value)}
            style={{ padding: 6 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 13, gap: 4 }}>
          Decision cutoff (day before, UTC)
          <select
            value={cutoffHour}
            onChange={(e) => setCutoffHour(Number(e.target.value))}
            style={{ padding: 6 }}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>

        {data && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Cutoff used: <b>{fmtStamp(data.cutoff_utc)}</b>
          </div>
        )}
      </div>

      {loading && <p>Loading from Elexon…</p>}
      {error && (
        <p style={{ color: "#b91c1c" }}>
          Could not load data: {error}. Is the backend running on port 8000?
        </p>
      )}

      {data && stats && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <Card
              label="Forecast energy"
              value={fmtMWh(stats.forecastMWh)}
              sub="Total wind expected for the day"
            />
            <Card
              label="Peak forecast"
              value={fmtMW(stats.peak?.forecast)}
              sub={stats.peak ? `at ${hhmm(stats.peak.startTime)} UTC` : ""}
            />
            <Card
              label="Latest forecast issued"
              value={stats.lastPub ? stats.lastPub.slice(11, 16) : "n/a"}
              sub={stats.lastPub ? `${stats.lastPub.slice(0, 10)} UTC` : ""}
            />
            <Card
              label="Actual energy"
              value={fmtMWh(stats.actualMWh)}
              sub={stats.missingActual === 48 ? "Not yet available" : "Outturn (FUELHH)"}
            />
          </div>

          {/* Chart */}
          <div style={{ height: 380, border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" interval={3} tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{ value: "MW", angle: -90, position: "insideLeft" }}
                />
                <Tooltip formatter={(v) => (v == null ? "n/a" : `${Math.round(v).toLocaleString()} MW`)} />
                <Legend />
                <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast (at cutoff)"
                    stroke="#0f766e"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Data-quality notes */}
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 10, lineHeight: 1.6 }}>
            {stats.missingForecast > 24 && (
               <div>
                ⚠ {stats.missingForecast} of 48 half-hours have no forecast published before this cutoff.
               </div>
            )}
            {stats.missingActual > 0 && stats.missingActual < 48 && (
              <div>⚠ {stats.missingActual} of 48 half-hours have no actual value.</div>
            )}
            <div>
              Forecast energy = sum of half-hourly MW × 0.5 h. Times are UTC, which equals UK time in
              January.
            </div>
          </div>
        </>
      )}
    </section>
  );
}