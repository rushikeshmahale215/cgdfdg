import { NavLink, Route, Routes } from "react-router-dom";
import Overview from "./pages/overview.jsx";
import ForecastPage from "./pages/ForecastPage.jsx";
import AccuracyPage from "./pages/AccuracyPage.jsx";

const linkStyle = ({ isActive }) => ({
  padding: "8px 14px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#fff" : "#374151",
  background: isActive ? "#0f766e" : "transparent",
  fontWeight: 500,
  fontSize: 14,
});

export default function App() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 }}>
        <div
          style={{
            maxWidth: 1100, margin: "0 auto", padding: "12px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0f766e", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
              W
            </div>
            <div style={{ fontWeight: 600, fontSize: 17 }}>
              Wind Forecast Desk <span style={{ color: "#6b7280", fontWeight: 400 }}>· UK Day-Ahead</span>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 6 }}>
            <NavLink to="/" end style={linkStyle}>Overview</NavLink>
            <NavLink to="/forecast" style={linkStyle}>Forecast</NavLink>
            <NavLink to="/accuracy" style={linkStyle}>Accuracy</NavLink>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, width: "100%", maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/accuracy" element={<AccuracyPage />} />
        </Routes>
      </main>

      <footer style={{ borderTop: "1px solid #e5e7eb", padding: "14px 20px", fontSize: 12, color: "#6b7280", textAlign: "center" }}>
        Contains BMRS data © Elexon Limited copyright and database right.
      </footer>
    </div>
  );
}
