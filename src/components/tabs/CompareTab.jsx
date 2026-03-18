import { useState, useCallback } from "react";
import {
  ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Sparkline from "../Sparkline.jsx";
import { LANES, MODE_COLORS, TOOLTIP_STYLE } from "../../constants.js";
import { generateData, fitKoopman, runFromState } from "../../engine/koopman.js";

export default function CompareTab({ state, horizon, margin, lane }) {
  const [compareData, setCompareData] = useState([]);
  const [comparing, setComparing] = useState(false);

  const runCompare = useCallback(async () => {
    setComparing(true);
    const results = await Promise.all(LANES.map(l => new Promise(resolve => setTimeout(() => {
      const data = generateData(365, 2.4, l.charCodeAt(0) + l.charCodeAt(4));
      const m = fitKoopman(data.slice(0, 180));
      const { points, pt, g0 } = runFromState(m, state, horizon, margin);
      const modeNames = ["Seasonal","Capacity Cycle","Fuel Pass-Through","Demand Shock","Contract Drift"];
      const contribs = modeNames.map((name, idx) => {
        const rowI = m.K[idx] || m.K[0];
        return { name, value: rowI.reduce((s, v, j) => s + v * g0[j], 0) * m.std[0] * (0.5 / (idx+1)) };
      });
      const dominant = contribs.reduce((a, b) => Math.abs(a.value) > Math.abs(b.value) ? a : b);
      const h = Math.min(horizon, 14);
      const conf = Math.max(0, 1 - (m.residStd * m.std[0] * Math.sqrt(h)) / Math.max(pt.rate, 0.01) * 2);
      const trend = points[h].rate - points[0].rate;
      resolve({ lane: l, rate: pt.rate, low: pt.low, high: pt.high, confidence: +conf.toFixed(3), dominant: dominant.name, trend, points });
    }, 0))));
    setCompareData(results);
    setComparing(false);
  }, [state, horizon, margin]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2 }}>LANE RATE COMPARISON  ·  {horizon}d FORWARD</div>
          <div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>Runs Koopman independently per lane using current market state vector</div>
        </div>
        <button className="compare-run-btn" onClick={runCompare} disabled={comparing}>
          {comparing ? "COMPUTING ALL LANES..." : "▶  RUN ALL LANES"}
        </button>
      </div>

      {compareData.length === 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#484f58" }}>Click RUN ALL LANES to compare rates across all five lanes simultaneously</div>
        </div>
      )}

      {compareData.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #21262d" }}>
                {["LANE", "QUOTED RATE", "RANGE", "CONFIDENCE", "DOMINANT MODE", "TREND", "TRAJECTORY"].map(h => (
                  <th key={h} style={{ fontSize: 9, color: "#484f58", letterSpacing: 1.5, padding: "10px 16px", textAlign: "left", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareData.sort((a, b) => b.rate - a.rate).map((row, i) => (
                <tr key={row.lane} style={{ borderBottom: i < compareData.length - 1 ? "1px solid #161b22" : "none", background: row.lane === lane ? "#0d1f3c22" : "transparent" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, color: row.lane === lane ? "#58a6ff" : "#e6edf3", fontWeight: row.lane === lane ? 600 : 400 }}>{row.lane}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, color: "#e6edf3", fontWeight: 600 }}>${row.rate.toFixed(2)}</span>
                    <span style={{ fontSize: 9, color: "#484f58" }}>/mi</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 10, color: "#58a6ff" }}>${row.low.toFixed(3)}</span>
                    <span style={{ fontSize: 9, color: "#484f58", margin: "0 4px" }}>–</span>
                    <span style={{ fontSize: 10, color: "#58a6ff" }}>${row.high.toFixed(3)}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, color: row.confidence > 0.7 ? "#2ea043" : row.confidence > 0.5 ? "#d29922" : "#f85149", fontWeight: 600 }}>
                      {(row.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 9, color: MODE_COLORS[row.dominant] || "#8b949e" }}>{row.dominant}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, color: row.trend > 0.01 ? "#f87171" : row.trend < -0.01 ? "#34d399" : "#8b949e", fontWeight: 600 }}>
                      {row.trend > 0.01 ? "↑" : row.trend < -0.01 ? "↓" : "→"} {row.trend >= 0 ? "+" : ""}{row.trend.toFixed(3)}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Sparkline data={row.points} color={row.lane === lane ? "#58a6ff" : "#30363d"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {compareData.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 14 }}>RATE SPREAD  ·  ALL LANES</div>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={compareData.sort((a, b) => b.rate - a.rate)} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 70 }}>
              <XAxis type="number" stroke="#484f58" tick={{ fontSize: 10, fill: "#484f58" }} tickFormatter={v => `$${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="lane" stroke="#484f58" tick={{ fontSize: 10, fill: "#484f58" }} width={60} />
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`$${v.toFixed(4)}/mi`]} />
              <Line dataKey="low" stroke="none" dot={false} />
              <Line dataKey="high" stroke="none" dot={false} />
              <Line dataKey="rate" stroke="#58a6ff" strokeWidth={0} dot={{ r: 5, fill: "#58a6ff", strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
