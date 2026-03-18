import { useState, useMemo } from "react";
import {
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { DIESEL_REF, TRUCK_MPG, TOOLTIP_STYLE } from "../../constants.js";
import { runFromState } from "../../engine/koopman.js";

export default function FuelTab({ model, state, horizon, margin, quote }) {
  const [dieselPrice, setDieselPrice] = useState(3.65);
  const [loadMiles, setLoadMiles] = useState(500);

  // Sensitivity curve — recomputes when model/state/horizon/margin change
  const fuelCurve = useMemo(() => {
    if (!model) return [];
    return Array.from({ length: 17 }, (_, i) => {
      const dp = +(2.0 + i * 0.25).toFixed(2);
      const fi = Math.max(0.6, Math.min(1.8, dp / DIESEL_REF));
      const { pt } = runFromState(model, { ...state, fuel_index: fi }, horizon, margin);
      return { diesel: dp, rate: pt.rate };
    });
  }, [model, state, horizon, margin]);

  const fuelIndex = dieselPrice / DIESEL_REF;
  const fuelPt = model ? runFromState(model, { ...state, fuel_index: Math.max(0.6, Math.min(1.8, fuelIndex)) }, horizon, margin).pt : null;
  const fuelRateDelta = (fuelPt && quote) ? fuelPt.rate - quote.rate : 0;
  const sensitivity = fuelCurve.length >= 2 ? Math.abs((fuelCurve[1].rate - fuelCurve[0].rate) / 0.25 * 0.10) : 0;
  const gallons = loadMiles / TRUCK_MPG;
  const fuelCostDelta = gallons * (dieselPrice - DIESEL_REF);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2 }}>DIESEL FUEL IMPACT CALCULATOR</div>

      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#8b949e" }}>Diesel Price</span>
              <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>${dieselPrice.toFixed(2)}/gal</span>
            </div>
            <input type="range" className="slider orange" min={2.0} max={6.0} step={0.05} value={dieselPrice}
              onChange={e => setDieselPrice(parseFloat(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: "#484f58" }}>$2.00</span>
              <span style={{ fontSize: 9, color: "#484f58" }}>Reference: ${DIESEL_REF.toFixed(2)}</span>
              <span style={{ fontSize: 9, color: "#484f58" }}>$6.00</span>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#8b949e" }}>Load Miles</span>
              <span style={{ fontSize: 11, color: "#58a6ff", fontWeight: 600 }}>{loadMiles} mi</span>
            </div>
            <input type="range" className="slider" min={100} max={2000} step={50} value={loadMiles}
              onChange={e => setLoadMiles(parseInt(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: "#484f58" }}>100</span>
              <span style={{ fontSize: 9, color: "#484f58" }}>{(loadMiles / TRUCK_MPG).toFixed(0)} gal @ {TRUCK_MPG} MPG</span>
              <span style={{ fontSize: 9, color: "#484f58" }}>2000</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>FUEL INDEX</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: fuelIndex > 1.1 ? "#f87171" : fuelIndex < 0.9 ? "#34d399" : "#e6edf3", lineHeight: 1 }}>
            {fuelIndex.toFixed(3)}
          </div>
          <div style={{ fontSize: 9, color: "#484f58", marginTop: 4 }}>
            {fuelIndex > 1 ? "+" : ""}{((fuelIndex - 1) * 100).toFixed(1)}% vs reference
          </div>
        </div>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>RATE IMPACT</div>
          {!model ? (
            <div style={{ fontSize: 10, color: "#484f58" }}>Run Koopman first</div>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: fuelRateDelta > 0.01 ? "#f87171" : fuelRateDelta < -0.01 ? "#34d399" : "#8b949e" }}>
                {fuelRateDelta >= 0 ? "+" : ""}{fuelRateDelta.toFixed(4)}
              </div>
              <div style={{ fontSize: 9, color: "#484f58", marginTop: 4 }}>$/mi vs base quote</div>
            </>
          )}
        </div>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>SENSITIVITY</div>
          {!model ? (
            <div style={{ fontSize: 10, color: "#484f58" }}>Run Koopman first</div>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#f59e0b", lineHeight: 1 }}>
                +{sensitivity.toFixed(4)}
              </div>
              <div style={{ fontSize: 9, color: "#484f58", marginTop: 4 }}>$/mi per $0.10/gal diesel</div>
            </>
          )}
        </div>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>LOAD FUEL COST Δ</div>
          <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: fuelCostDelta > 0 ? "#f87171" : fuelCostDelta < 0 ? "#34d399" : "#8b949e" }}>
            {fuelCostDelta >= 0 ? "+" : ""}${fuelCostDelta.toFixed(0)}
          </div>
          <div style={{ fontSize: 9, color: "#484f58", marginTop: 4 }}>per {loadMiles}mi load vs ref</div>
        </div>
      </div>

      {fuelCurve.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 9, color: "#484f58", letterSpacing: 2 }}>RATE vs DIESEL PRICE  ·  KOOPMAN SENSITIVITY CURVE</span>
            <span style={{ fontSize: 9, color: "#484f58" }}>Base: ${DIESEL_REF.toFixed(2)}/gal  ·  {horizon}d horizon  ·  {margin}% margin</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={fuelCurve} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
              <XAxis dataKey="diesel" stroke="#484f58" tick={{ fontSize: 10, fill: "#484f58" }} tickLine={false} tickFormatter={v => `$${v.toFixed(2)}`} label={{ value: "Diesel $/gal", position: "insideBottom", offset: -2, fill: "#484f58", fontSize: 9 }} />
              <YAxis stroke="#484f58" tick={{ fontSize: 10, fill: "#484f58" }} tickLine={false} tickFormatter={v => `$${v.toFixed(3)}`} width={68} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#8b949e" }} formatter={(v) => [`$${v.toFixed(4)}/mi`, "Quoted Rate"]} labelFormatter={v => `Diesel $${parseFloat(v).toFixed(2)}/gal`} />
              <ReferenceLine x={dieselPrice} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Current", fill: "#f59e0b", fontSize: 9, position: "top" }} />
              <ReferenceLine x={DIESEL_REF} stroke="#484f58" strokeDasharray="3 3" strokeWidth={1} label={{ value: "Ref", fill: "#484f58", fontSize: 9, position: "top" }} />
              <Area type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} fill="url(#fuelGrad)" dot={false} activeDot={{ r: 4, fill: "#f59e0b" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 10 }}>LOAD ECONOMICS  ·  {loadMiles} MILES</div>
          {[
            ["Gallons consumed", `${gallons.toFixed(1)} gal`],
            ["Fuel cost @ ref $" + DIESEL_REF.toFixed(2), `$${(gallons * DIESEL_REF).toFixed(2)}`],
            ["Fuel cost @ $" + dieselPrice.toFixed(2), `$${(gallons * dieselPrice).toFixed(2)}`],
            ["Fuel cost delta", `${fuelCostDelta >= 0 ? "+" : ""}$${fuelCostDelta.toFixed(2)}`],
            ["Per-mile fuel impact", `${(fuelCostDelta / loadMiles).toFixed(4)} $/mi`],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#8b949e" }}>{label}</span>
              <span style={{ fontSize: 10, color: "#e6edf3", fontWeight: 500 }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 10 }}>DIESEL CONTEXT  ·  HISTORIC RANGES</div>
          {[
            ["2020 pandemic low",   "$2.18/gal"],
            ["2022 war-spike high", "$5.56/gal"],
            ["2024 annual avg",     "$3.81/gal"],
            ["2025 annual avg",     "$3.63/gal"],
            ["Reference (index=1)", `$${DIESEL_REF.toFixed(2)}/gal`],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#8b949e" }}>{label}</span>
              <span style={{ fontSize: 10, color: "#484f58" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
