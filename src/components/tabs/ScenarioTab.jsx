import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { SCENARIO_PRESETS, SCENARIO_DELTA_FIELDS, TOOLTIP_STYLE } from "../../constants.js";
import { runFromState } from "../../engine/koopman.js";

export default function ScenarioTab({ model, state, horizon, margin, quote, trajectory }) {
  const [scenarioDeltas, setScenarioDeltas] = useState({ fuel_index: 0, ltr: 0, cap_util: 0, spot_rate: 0 });
  const [activePreset, setActivePreset] = useState(null);
  const [scenarioTraj, setScenarioTraj] = useState([]);

  // Recompute scenario trajectory instantly when model/state/deltas change
  useEffect(() => {
    if (!model) return;
    const s = state;
    const scenState = {
      ...s,
      fuel_index: Math.max(0.6, Math.min(1.8, s.fuel_index + scenarioDeltas.fuel_index)),
      ltr:        Math.max(0.5, Math.min(8.0, s.ltr        + scenarioDeltas.ltr)),
      cap_util:   Math.max(0.3, Math.min(1.0, s.cap_util   + scenarioDeltas.cap_util)),
      spot_rate:  Math.max(1.0, Math.min(5.0, s.spot_rate  + scenarioDeltas.spot_rate)),
    };
    const { points } = runFromState(model, scenState, horizon, margin);
    setScenarioTraj(points);
  }, [model, state, scenarioDeltas, horizon, margin]);

  // Overlay: merge base trajectory with scenario trajectory
  const overlayData = useMemo(() =>
    trajectory.map((pt, i) => ({ ...pt, sRate: scenarioTraj[i]?.rate, sHigh: scenarioTraj[i]?.high, sLow: scenarioTraj[i]?.low })),
    [trajectory, scenarioTraj]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 10 }}>SCENARIO ANALYSIS  ·  BASE vs SHOCK</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SCENARIO_PRESETS.map(p => (
            <button key={p.label} className={`preset-btn ${activePreset === p.label ? "active" : ""}`}
              onClick={() => { setScenarioDeltas(p.deltas); setActivePreset(p.label); }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 14 }}>SCENARIO DELTAS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {SCENARIO_DELTA_FIELDS.map(f => (
              <div key={f.key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>{f.label}</span>
                  <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 500 }}>
                    {scenarioDeltas[f.key] >= 0 ? "+" : ""}{f.key === "cap_util" ? (scenarioDeltas[f.key]*100).toFixed(0)+"%" : scenarioDeltas[f.key].toFixed(2)}{f.unit}
                  </span>
                </div>
                <input type="range" className="slider orange" min={f.min} max={f.max} step={f.step} value={scenarioDeltas[f.key]}
                  onChange={e => { setScenarioDeltas(d => ({ ...d, [f.key]: parseFloat(e.target.value) })); setActivePreset(null); }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {quote && scenarioTraj.length > 0 && (() => {
            const scenPt = scenarioTraj[Math.min(horizon, 14)];
            const delta = scenPt ? scenPt.rate - quote.rate : 0;
            const pct = quote.rate > 0 ? (delta / quote.rate) * 100 : 0;
            const color = delta > 0.02 ? "#f87171" : delta < -0.02 ? "#34d399" : "#8b949e";
            return (
              <>
                <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
                  <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 12 }}>RATE AT HORIZON  ·  DAY {horizon}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 9, color: "#484f58", marginBottom: 4 }}>BASE</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: "#58a6ff" }}>${quote.rate.toFixed(3)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "#484f58", marginBottom: 4 }}>SCENARIO</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: "#f59e0b" }}>${scenPt?.rate.toFixed(3) ?? "--"}</div>
                    </div>
                  </div>
                </div>
                <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
                  <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>RATE DELTA</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color }}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(4)}/mi
                  </div>
                  <div style={{ fontSize: 11, color, marginTop: 4 }}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% vs base scenario
                  </div>
                </div>
              </>
            );
          })()}
          {!model && (
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: 20, color: "#484f58", fontSize: 10 }}>
              Run Koopman first to enable scenario analysis
            </div>
          )}
        </div>
      </div>

      {overlayData.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 9, color: "#484f58", letterSpacing: 2 }}>TRAJECTORY OVERLAY  ·  BASE vs SCENARIO</span>
            <div style={{ display: "flex", gap: 16 }}>
              {[["Base Rate", "#58a6ff"], ["Scenario Rate", "#f59e0b"]].map(([label, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 2, background: color }} />
                  <span style={{ fontSize: 9, color: "#8b949e" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={overlayData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="scenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="day" stroke="#484f58" tick={{ fontSize: 10, fill: "#484f58" }} tickLine={false} label={{ value: "Days Forward", position: "insideBottom", offset: -2, fill: "#484f58", fontSize: 9 }} />
              <YAxis stroke="#484f58" tick={{ fontSize: 10, fill: "#484f58" }} tickLine={false} tickFormatter={v => `$${v.toFixed(2)}`} width={60} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#8b949e" }} formatter={(v, name) => [`$${v.toFixed(4)}/mi`, name]} labelFormatter={d => `Day +${d}`} />
              <ReferenceLine x={horizon} stroke="#30363d" strokeDasharray="4 4" strokeWidth={1} />
              <Area type="monotone" dataKey="high" stroke="none" fill="url(#baseGrad)" />
              <Area type="monotone" dataKey="low" stroke="none" fill="#0a0d14" />
              <Area type="monotone" dataKey="sHigh" stroke="none" fill="url(#scenGrad)" />
              <Area type="monotone" dataKey="sLow" stroke="none" fill="#0a0d14" />
              <Line type="monotone" dataKey="rate" stroke="#58a6ff" strokeWidth={2} dot={false} name="Base Rate" />
              <Line type="monotone" dataKey="sRate" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Scenario Rate" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
