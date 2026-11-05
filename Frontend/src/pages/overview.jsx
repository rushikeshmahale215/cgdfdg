import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAccuracy } from "../api.js";

const CUTOFF = 9; // default decision cutoff, 09:00 UTC on D-1
const fmt = (v) => (v == null ? "n/a" : Math.round(v).toLocaleString());

const panel = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 };

const btn = (primary) => ({
  display: "inline-block",
  padding: "10px 18px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  textDecoration: "none",
  background: primary ? "#fff" : "transparent",
  color: primary ? "#0f766e" : "#fff",
  border: primary ? "1px solid #fff" : "1px solid rgba(255,255,255,0.6)",
});

function Kpi({ label, value, sub, accent, loading }) {
  return (
    <div style={{ ...panel, borderTop: `4px solid ${accent}`, flex: "1 1 220px" }}>
      <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {loading ? (
        <div style={{ height: 34, margin: "8px 0", borderRadius: 6, background: "#f1f5f9" }} />
      ) : (
        <div style={{ fontSize: 30, fontWeight: 700, margin: "4px 0", color: "#111827" }}>
          {value}
          <span style={{ fontSize: 14, fontWeight: 400, color: "#6b7280" }}> MW</span>
        </div>
      )}
      <div style={{ fontSize: 13, color: "#4b5563" }}>{sub}</div>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div style={{ ...panel, flex: "1 1 260px" }}>
      <div
        style={{
          width: 30, height: 30, borderRadius: "50%", background: "#ccfbf1", color: "#0f766e",
          display: "grid", placeItems: "center", fontWeight: 700, marginBottom: 10,
        }}
      >
        {n}
      </div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 14, color: "#4b5563" }}>{text}</div>
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAccuracy("2026-01-01", "2026-01-31", CUTOFF)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const s = data?.summary;
  const byDay = data?.by_day ?? [];

  const { best, worst } = useMemo(() => {
    if (!byDay.length) return {};
    return {
      best: byDay.reduce((m, d) => (d.mae < m.mae ? d : m), byDay[0]),
      worst: byDay.reduce((m, d) => (d.mae > m.mae ? d : m), byDay[0]),
    };
  }, [byDay]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero */}
      <section
        style={{
          borderRadius: 16, padding: "36px 32px", color: "#fff",
          background: "linear-gradient(135deg, #0f766e 0%, #0e7490 100%)",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", opacity: 0.85 }}>
          Day-ahead wind desk · January 2026
        </div>
        <h1 style={{ color: "#fff", fontSize: 34, margin: "8px 0 12px", maxWidth: 640 }}>
          Know how much wind to count on, and how wrong it can be.
        </h1>
        <p style={{ maxWidth: 620, opacity: 0.92, fontSize: 16 }}>
          See the latest national wind forecast you actually had at decision time, and size your
          day-ahead thermal purchase with measured forecast error in mind.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          <Link to="/forecast" style={btn(true)}>Open day-ahead forecast</Link>
          <Link to="/accuracy" style={btn(false)}>See accuracy analysis</Link>
        </div>
      </section>

      {/* Headline numbers */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>January 2026 at a glance</h3>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Forecast as known at {String(CUTOFF).padStart(2, "0")}:00 UTC the day before delivery
            {s ? ` · ${fmt(s.n)} half-hours scored` : ""}
          </span>
        </div>

        {error && (
          <div style={{ ...panel, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 14 }}>
            Could not load live numbers ({error}). Check that the backend is running on port 8000.
          </div>
        )}

        {!error && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Kpi
              loading={loading}
              accent="#0f766e"
              label="Typical miss (MAE)"
              value={fmt(s?.mae)}
              sub="Average gap between forecast and actual per half-hour."
            />
            <Kpi
              loading={loading}
              accent="#0e7490"
              label="Planning buffer (P90)"
              value={fmt(s?.p90_abs_error)}
              sub="In 9 of 10 half-hours the miss was smaller than this."
            />
            <Kpi
              loading={loading}
              accent="#7c3aed"
              label="Big-miss measure (RMSE)"
              value={fmt(s?.rmse)}
              sub="Rises when a few large misses occur."
            />
            <Kpi
              loading={loading}
              accent={s && s.bias < 0 ? "#dc2626" : "#f59e0b"}
              label="Average lean (bias)"
              value={s ? `${s.bias > 0 ? "+" : ""}${fmt(s.bias)}` : "n/a"}
              sub={
                s
                  ? s.bias > 0
                    ? "Wind came in above forecast on average."
                    : "Wind came in below forecast on average."
                  : ""
              }
            />
          </div>
        )}
      </section>

      {/* Takeaway + trend */}
      {s && (
        <section style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ ...panel, flex: "1 1 320px", background: "#f0fdfa", borderColor: "#99f6e4" }}>
            <h4 style={{ marginBottom: 8 }}>What this means for your buying</h4>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
              <li>
                Plan around the forecast, but expect a typical miss of about <b>{fmt(s.mae)} MW</b>.
              </li>
              <li>
                Holding a contingency near <b>{fmt(s.p90_abs_error)} MW</b> would have covered 90% of
                half-hours.
              </li>
              {best && worst && (
                <li>
                  Steadiest day: <b>{best.date.slice(8)} Jan</b> ({fmt(best.mae)} MW). Hardest:{" "}
                  <b>{worst.date.slice(8)} Jan</b> ({fmt(worst.mae)} MW).
                </li>
              )}
            </ul>
          </div>

          <div style={{ ...panel, flex: "2 1 420px" }}>
            <div style={{ fontWeight: 600 }}>Daily forecast error through January</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>MAE per delivery day, in MW</div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byDay} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="maeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(8)} />
                  <YAxis tick={{ fontSize: 11 }} width={44} />
                  <Tooltip
                    formatter={(v) => `${Math.round(v).toLocaleString()} MW`}
                    labelFormatter={(d) => `${d.slice(8)} Jan 2026`}
                  />
                  <Area type="monotone" dataKey="mae" name="MAE" stroke="#0f766e" strokeWidth={2} fill="url(#maeFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section>
        <h3>How it supports the day-ahead decision</h3>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Step
            n="1"
            title="See what you'll have"
            text="The latest wind forecast published before your cutoff, half-hour by half-hour. Later forecasts are excluded so nothing is judged with hindsight."
          />
          <Step
            n="2"
            title="Measure how wrong it can be"
            text="Forecasts are compared with actual wind output: typical miss, big misses, and whether errors lean one way."
          />
          <Step
            n="3"
            title="Buy with a buffer"
            text="Use the error figures to decide how much thermal cover to add on top of the planned purchase."
          />
        </div>
      </section>

      <section style={{ fontSize: 12, color: "#6b7280" }}>
        Data: Elexon BMRS, national wind actuals (FUELHH) and wind forecasts (WINDFOR). Error = actual −
        forecast. Times are UTC, which equals UK time in January.
      </section>
    </div>
  );
}