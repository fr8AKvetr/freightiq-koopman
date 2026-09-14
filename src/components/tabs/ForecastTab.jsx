import {
  AreaChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TOOLTIP_STYLE } from "../../constants.js";

export default function ForecastTab({ quote, trajectory, horizon, lane }) {
  return (
    <>
      {quote && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
          <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>RESEARCH RATE</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#e6edf3", lineHeight: 1 }}>${quote.rate.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>/mile · {quote.horizon}d forward</div>
          </div>
          <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>RESIDUAL ENVELOPE</div>
            <div style={{ fontSize: 13, color: "#58a6ff", fontWeight: 500 }}>${quote.low.toFixed(3)}</div>
            <div style={{ fontSize: 10, color: "#484f58", margin: "2px 0" }}>to</div>
            <div style={{ fontSize: 13, color: "#58a6ff", fontWeight: 500 }}>${quote.high.toFixed(3)}</div>
          </div>
          <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>SUPPORTED INTERPRETATION</div>
            <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.6 }}>Research projection only. The envelope scales the in-sample residual by the square root of the horizon. Coverage is uncalibrated; confidence probabilities and causal drivers are unavailable.</div>
          </div>
        </div>
      )}

      {trajectory.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 9, color: "#484f58", letterSpacing: 2 }}>14-DAY FORWARD RATE TRAJECTORY  ·  {lane}</span>
            <div style={{ display: "flex", gap: 14 }}>
              {[["Rate", "#58a6ff"], ["Residual Envelope", "#1a3a5c"]].map(([label, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 2, background: color }} />
                  <span style={{ fontSize: 9, color: "#8b949e" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trajectory} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="day" stroke="#484f58" tick={{ fontSize: 10, fill: "#484f58" }} tickLine={false} label={{ value: "Days Forward", position: "insideBottom", offset: -2, fill: "#484f58", fontSize: 9 }} />
              <YAxis stroke="#484f58" tick={{ fontSize: 10, fill: "#484f58" }} tickLine={false} tickFormatter={v => `$${v.toFixed(2)}`} width={60} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#8b949e" }} itemStyle={{ color: "#e6edf3" }} formatter={(v, name) => [`$${v.toFixed(4)}/mi`, name]} labelFormatter={d => `Day +${d}`} />
              <ReferenceLine x={horizon} stroke="#2ea043" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Quote", fill: "#2ea043", fontSize: 9, position: "top" }} />
              <Area type="monotone" dataKey="high" stroke="none" fill="url(#bandGrad)" />
              <Area type="monotone" dataKey="low" stroke="none" fill="#0a0d14" />
              <Line type="monotone" dataKey="rate" stroke="#58a6ff" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#58a6ff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
        {[
          ["01  STATE",   "7-dim market state: rate, L/T, fuel, capacity, spread, shock, season"],
          ["02  LIFT",    "25-dim observable dictionary g(x): polynomials, Fourier, decay kernels"],
          ["03  EDMD",    "Fit linear operator K such that g(x_{t+1}) ≈ K · g(x_t)"],
          ["04  PROJECT", "Apply K^n · g(x_now) → invert to rate space → quote + bands"],
        ].map(([title, desc]) => (
          <div key={title} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 4, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 10, color: "#8b949e", lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </>
  );
}
