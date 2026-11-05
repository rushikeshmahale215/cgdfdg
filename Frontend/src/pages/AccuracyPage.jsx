import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAccuracy } from "../api.js";

const box = { border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" };
const fmt = (v) => (v == null ? "n/a" : Math.round(v).toLocaleString());

function Card({ label, value, unit = "MW", sub }) {
  return (
    <div style={{ ...box, flex: "1 1 170px", padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
        {value}
        <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}> {unit}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ChartBox({ title, note, children }) {
  return (
    <div style={{ ...box, marginBottom: 20 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
      {note && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{note}</div>}
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const tip = (v) => `${Math.round(v).toLocaleString()} MW`;

export default function AccuracyPage() {
  const [start, setStart] = useState("2026-01-01");
  const [end, setEnd] = useState("2026-01-31");
  const [cutoffHour, setCutoffHour] = useState(9);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (start > end) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAccuracy(start, end, cutoffHour)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [start, end, cutoffHour]);

  const s = data?.summary;
  const byHour = data?.by_hour ?? [];
  const byDay = data?.by_day ?? [];
  const worstHour = byHour.length
    ? byHour.reduce((m, h) => (h.mae > m.mae ? h : m), byHour[0])
    : null;
  const worstDay = byDay.length ? byDay.reduce((m, d) => (d.mae > m.mae ? d : m), byDay[0]) : null;

  return (
    <section>
      <h3 style={{ marginTop: 0 }}>Forecast accuracy</h3>
      <p style={{ color: "#4b5563", marginTop: -8 }}>
        For each half-hour, we compare the actual wind output with the forecast you would have had at the
        decision cutoff. Error = actual − forecast.
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end", margin: "16px 0" }}>
        <label style={{ display: "flex", flexDirection: "column", fontSize: 13, gap: 4 }}>
          From
          <input type="date" value={start} min="2026-01-01" max="2026-01-31"
            onChange={(e) => e.target.value && setStart(e.target.value)} style={{ padding: 6 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: 13, gap: 4 }}>
          To
          <input type="date" value={end} min="2026-01-01" max="2026-01-31"
            onChange={(e) => e.target.value && setEnd(e.target.value)} style={{ padding: 6 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: 13, gap: 4 }}>
          Decision cutoff (day before, UTC)
          <select value={cutoffHour} onChange={(e) => setCutoffHour(Number(e.target.value))} style={{ padding: 6 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>
        </label>
      </div>

      {start > end && <p style={{ color: "#b91c1c" }}>"From" must be on or before "To".</p>}
      {loading && <p>Loading from Elexon… (a full month can take a few seconds)</p>}
      {error && (
        <p style={{ color: "#b91c1c" }}>
          Could not load data: {error}. Is the backend running on port 8000?
        </p>
      )}

      {s && !loading && (
        <>
          {/* Headline metrics */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <Card label="MAE" value={fmt(s.mae)} sub="Typical miss per half-hour" />
            <Card label="RMSE" value={fmt(s.rmse)} sub="Penalises big misses more" />
            <Card
              label="Bias"
              value={`${s.bias > 0 ? "+" : ""}${fmt(s.bias)}`}
              sub={s.bias > 0 ? "Wind under-forecast on average" : "Wind over-forecast on average"}
            />
            <Card label="P90 abs error" value={fmt(s.p90_abs_error)} sub="9 in 10 half-hours miss by less" />
            <Card label="Samples" value={fmt(s.n)} unit="points" sub="Where forecast and actual both exist" />
          </div>

          {/* What it means for buying */}
          <div style={{ ...box, background: "#f0fdfa", borderColor: "#99f6e4", marginBottom: 20, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>What this means for your buying</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                Wind forecasts miss by about <b>{fmt(s.mae)} MW</b> on a typical half-hour. In 90% of
                half-hours the miss is under <b>{fmt(s.p90_abs_error)} MW</b>.
              </li>
              <li>
                Consider a contingency of roughly <b>{fmt(s.p90_abs_error)} MW</b> on top of the
                planned thermal purchase, or flexible cover for that amount.
              </li>
              <li>
                {s.bias > 0
                  ? `On average wind beat the forecast by ${fmt(s.bias)} MW, so you tended to over-buy.`
                  : `On average wind fell short of the forecast by ${fmt(Math.abs(s.bias))} MW, so you tended to under-buy.`}
              </li>
              {worstHour && (
                <li>
                  Errors are largest around <b>{String(worstHour.hour).padStart(2, "0")}:00 UTC</b> (MAE{" "}
                  {fmt(worstHour.mae)} MW), so allow a bigger margin for those hours.
                </li>
              )}
              {worstDay && (
                <li>
                  The hardest day was <b>{worstDay.date}</b> (MAE {fmt(worstDay.mae)} MW).
                </li>
              )}
            </ul>
          </div>

          {/* By hour */}
          <ChartBox
            title="Error by hour of day"
            note="Bars show MAE. Bias (actual − forecast) shows whether misses lean one way."
          >
            <BarChart data={byHour} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} tickFormatter={(h) => String(h).padStart(2, "0")} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: "MW", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={tip} labelFormatter={(h) => `${String(h).padStart(2, "0")}:00 UTC`} />
              <Legend />
              <Bar dataKey="mae" name="MAE" fill="#0f766e" />
              <Bar dataKey="bias" name="Bias" fill="#f59e0b" />
            </BarChart>
          </ChartBox>

          {/* By day */}
          <ChartBox
            title="Error by delivery day"
            note="Bias bars are amber when wind beat the forecast (over-buy) and red when it fell short (under-buy)."
          >
            <BarChart data={byDay} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(8)} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: "MW", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={tip} />
              <Legend />
              <Bar dataKey="mae" name="MAE" fill="#0f766e" />
              <Bar dataKey="bias" name="Bias">
                {byDay.map((d) => (
                  <Cell key={d.date} fill={d.bias >= 0 ? "#f59e0b" : "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ChartBox>

          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            <b>MAE</b> = mean of |actual − forecast|. <b>RMSE</b> = square root of the mean squared error.
            <b> Bias</b> = mean of (actual − forecast). <b>P90</b> = 90th percentile of |error|. Each
            forecast is the latest one published before the cutoff on the day before delivery. All times
            are UTC, which equals UK time in January.
          </div>
        </>
      )}
    </section>
  );
}