import { useState, useEffect, useCallback } from "react";
import { LANES, STATE_FIELDS, DEFAULT_API_CONFIG } from "./constants.js";
import { generateData, fitKoopman, runFromState } from "./engine/koopman.js";
import SettingsPanel from "./components/SettingsPanel.jsx";
import ForecastTab from "./components/tabs/ForecastTab.jsx";
import CompareTab from "./components/tabs/CompareTab.jsx";
import ScenarioTab from "./components/tabs/ScenarioTab.jsx";
import FuelTab from "./components/tabs/FuelTab.jsx";

export default function App() {
  const [lane, setLane] = useState("DAL-LAX");
  const [horizon, setHorizon] = useState(7);
  const [margin, setMargin] = useState(8);
  const [state, setState] = useState({
    spot_rate: 2.55, ltr: 4.1, fuel_index: 1.08,
    day_of_year: 310, days_since_shock: 6, cap_util: 0.87, contract_spread: 0.22,
  });
  const [model, setModel] = useState(null);
  const [trajectory, setTrajectory] = useState([]);
  const [quote, setQuote] = useState(null);
  const [fitting, setFitting] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiConfig, setApiConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("freightiq_api_config");
      if (!saved) return DEFAULT_API_CONFIG;
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_API_CONFIG, ...parsed, fieldMap: { ...DEFAULT_API_CONFIG.fieldMap, ...(parsed.fieldMap || {}) } };
    } catch { return DEFAULT_API_CONFIG; }
  });
  const [dataSource, setDataSource] = useState("SIMULATED");
  const [apiError, setApiError] = useState(null);
  const [testStatus, setTestStatus] = useState({ market: null, historical: null });

  // Tabs
  const [activeTab, setActiveTab] = useState("forecast");

  useEffect(() => {
    try { localStorage.setItem("freightiq_api_config", JSON.stringify(apiConfig)); } catch {}
  }, [apiConfig]);

  const buildHeaders = useCallback(() => {
    const h = { "Content-Type": "application/json" };
    if (apiConfig.apiKey) h[apiConfig.apiKeyHeader || "Authorization"] = `${apiConfig.apiKeyPrefix ?? ""}${apiConfig.apiKey}`.trim();
    return h;
  }, [apiConfig]);

  const fetchFromApi = useCallback(async (url, params = {}) => {
    const u = new URL(url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
    const res = await fetch(u.toString(), { headers: buildHeaders() });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }, [buildHeaders]);

  const mapFields = useCallback((obj) => {
    const result = {};
    Object.entries(apiConfig.fieldMap).forEach(([internal, external]) => {
      const val = obj[external];
      if (val !== undefined && val !== null && !isNaN(parseFloat(val))) result[internal] = parseFloat(val);
    });
    return result;
  }, [apiConfig.fieldMap]);

  const testConnection = useCallback(async (which, cfg) => {
    setTestStatus(s => ({ ...s, [which]: "testing" }));
    const url = which === "market" ? cfg.marketStateUrl : cfg.historicalUrl;
    try {
      const u = new URL(url);
      if (cfg.laneParam) u.searchParams.set(cfg.laneParam, lane);
      const h = { "Content-Type": "application/json" };
      if (cfg.apiKey) h[cfg.apiKeyHeader || "Authorization"] = `${cfg.apiKeyPrefix ?? ""}${cfg.apiKey}`.trim();
      const res = await fetch(u.toString(), { headers: h });
      setTestStatus(s => ({ ...s, [which]: res.ok ? "ok" : "error" }));
    } catch { setTestStatus(s => ({ ...s, [which]: "error" })); }
  }, [lane]);

  const fitAndQuote = useCallback(async () => {
    setFitting(true);
    setApiError(null);
    let currentState = { ...state };
    let historicalData = null, liveMarket = false;

    if (apiConfig.marketEnabled && apiConfig.marketStateUrl) {
      try {
        const raw = await fetchFromApi(apiConfig.marketStateUrl, { [apiConfig.laneParam || "lane"]: lane });
        const mapped = mapFields(raw);
        if (Object.keys(mapped).length > 0) { currentState = { ...currentState, ...mapped }; setState(s => ({ ...s, ...mapped })); liveMarket = true; }
      } catch (err) { setApiError(`Market state API: ${err.message}`); }
    }
    if (apiConfig.historicalEnabled && apiConfig.historicalUrl) {
      try {
        const raw = await fetchFromApi(apiConfig.historicalUrl, { [apiConfig.laneParam || "lane"]: lane, days: 180 });
        const items = Array.isArray(raw) ? raw : (raw.data || raw.items || raw.results || []);
        const mapped = items.map(mapFields).filter(d => d.spot_rate !== undefined);
        if (mapped.length >= 30) historicalData = mapped;
      } catch (err) { setApiError(prev => prev ? `${prev}  ·  Historical API: ${err.message}` : `Historical API: ${err.message}`); }
    }

    setDataSource(!liveMarket && !historicalData ? "SIMULATED" : liveMarket && historicalData ? "LIVE" : "PARTIAL");
    await new Promise(r => setTimeout(r, 50));

    const data = historicalData || generateData(365, 2.4, lane.charCodeAt(0) + lane.charCodeAt(4));
    const m = fitKoopman(data.slice(0, Math.min(data.length, 180)));
    setModel(m);

    const { points, pt, g0 } = runFromState(m, currentState, horizon, margin);
    setTrajectory(points);

    const h = Math.min(horizon, 14);
    const modeNames = ["Seasonal","Capacity Cycle","Fuel Pass-Through","Demand Shock","Contract Drift"];
    const contribs = modeNames.map((name, i) => {
      const rowI = m.K[i] || m.K[0];
      return { name, value: +(rowI.reduce((s, v, j) => s + v * g0[j], 0) * m.std[0] * (0.5 / (i+1))).toFixed(4) };
    });
    const dominant = contribs.reduce((a, b) => Math.abs(a.value) > Math.abs(b.value) ? a : b);
    const conf = Math.max(0, 1 - (m.residStd * m.std[0] * Math.sqrt(h)) / Math.max(pt.rate, 0.01) * 2);
    setQuote({ lane, horizon: h, rate: pt.rate, low: pt.low, high: pt.high, confidence: +conf.toFixed(3), dominant: dominant.name, contribs });
    setFitting(false);
  }, [lane, horizon, margin, state, apiConfig, fetchFromApi, mapFields]);

  useEffect(() => { fitAndQuote(); }, [lane]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStateChange = (k, v) => setState(s => ({ ...s, [k]: parseFloat(v) }));

  const sourceColor = dataSource === "LIVE" ? "#2ea043" : dataSource === "PARTIAL" ? "#d29922" : "#484f58";
  const anyApiEnabled = apiConfig.marketEnabled || apiConfig.historicalEnabled;

  return (
    <div style={{ background: "#0a0d14", minHeight: "100vh", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", color: "#c9d1d9", padding: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0d1117; } ::-webkit-scrollbar-thumb { background: #30363d; }
        .slider { -webkit-appearance: none; width: 100%; height: 2px; background: #21262d; outline: none; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #58a6ff; cursor: pointer; }
        .slider.orange::-webkit-slider-thumb { background: #f59e0b; }
        .lane-btn { background: none; border: 1px solid #21262d; color: #8b949e; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 11px; transition: all 0.15s; }
        .lane-btn:hover { border-color: #58a6ff; color: #58a6ff; }
        .lane-btn.active { background: #0d1f3c; border-color: #58a6ff; color: #58a6ff; }
        .quote-btn { background: #1a7f4e; border: none; color: #fff; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: 1px; transition: all 0.15s; }
        .quote-btn:hover { background: #2ea043; }
        .quote-btn:disabled { background: #21262d; color: #484f58; cursor: not-allowed; }
        .settings-btn { background: none; border: 1px solid #21262d; color: #8b949e; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 11px; transition: all 0.15s; }
        .settings-btn:hover { border-color: #58a6ff; color: #58a6ff; }
        .settings-btn.active { border-color: #d29922; color: #d29922; }
        .tab-btn { background: none; border: none; border-bottom: 2px solid transparent; color: #484f58; padding: 12px 18px; cursor: pointer; font-family: inherit; font-size: 10px; letter-spacing: 1.5px; transition: all 0.15s; }
        .tab-btn:hover:not(.active) { color: #8b949e; }
        .tab-btn.active { color: #58a6ff; border-bottom-color: #58a6ff; }
        .preset-btn { background: none; border: 1px solid #21262d; color: #8b949e; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 9px; letter-spacing: 1px; transition: all 0.15s; white-space: nowrap; }
        .preset-btn:hover { border-color: #f59e0b; color: #f59e0b; }
        .preset-btn.active { background: #1a1400; border-color: #f59e0b; color: #f59e0b; }
        .compare-run-btn { background: none; border: 1px solid #21262d; color: #8b949e; padding: 6px 14px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 10px; letter-spacing: 1px; transition: all 0.15s; }
        .compare-run-btn:hover:not(:disabled) { border-color: #58a6ff; color: #58a6ff; }
        .compare-run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        input:focus { border-color: #58a6ff !important; outline: none; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #21262d", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ea043", boxShadow: "0 0 8px #2ea043" }} />
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "#e6edf3", letterSpacing: 2 }}>FREIGHTIQ</span>
          <span style={{ color: "#484f58", fontSize: 11 }}>|</span>
          <span style={{ color: "#8b949e", fontSize: 11 }}>KOOPMAN RATE ENGINE</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: sourceColor }} />
            <span style={{ fontSize: 9, color: sourceColor, letterSpacing: 1 }}>{dataSource}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {LANES.map(l => (
              <button key={l} className={`lane-btn ${lane === l ? "active" : ""}`} onClick={() => setLane(l)}>{l}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: "#21262d", margin: "0 4px" }} />
          <button className={`settings-btn${anyApiEnabled ? " active" : ""}`} onClick={() => setShowSettings(true)}>⚙ API</button>
        </div>
      </div>

      {apiError && (
        <div style={{ background: "#1a0a0a", borderBottom: "1px solid #3d1a1a", padding: "8px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "#f85149" }}>⚠  {apiError}</span>
          <button onClick={() => setApiError(null)} style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 14 }}>×</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "calc(100vh - 53px)" }}>

        {/* Left Panel */}
        <div style={{ borderRight: "1px solid #21262d", padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 14 }}>MARKET STATE VECTOR  x_t</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {STATE_FIELDS.map(f => (
                <div key={f.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "#8b949e" }}>{f.label}</span>
                    <span style={{ fontSize: 11, color: "#58a6ff", fontWeight: 500 }}>
                      {f.key === "cap_util" ? `${(state[f.key]*100).toFixed(0)}${f.unit}` : `${state[f.key]}${f.unit}`}
                    </span>
                  </div>
                  <input type="range" className="slider" min={f.min} max={f.max} step={f.step} value={state[f.key]}
                    onChange={e => handleStateChange(f.key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #21262d", paddingTop: 16 }}>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 14 }}>QUOTE PARAMETERS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>Horizon</span>
                  <span style={{ fontSize: 11, color: "#58a6ff" }}>{horizon}d</span>
                </div>
                <input type="range" className="slider" min={1} max={14} step={1} value={horizon} onChange={e => setHorizon(+e.target.value)} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>Broker Margin</span>
                  <span style={{ fontSize: 11, color: "#58a6ff" }}>{margin}%</span>
                </div>
                <input type="range" className="slider" min={3} max={18} step={0.5} value={margin} onChange={e => setMargin(+e.target.value)} />
              </div>
            </div>
          </div>

          <button className="quote-btn" disabled={fitting} onClick={fitAndQuote}>
            {fitting ? "FITTING K..." : "▶  RUN KOOPMAN"}
          </button>

          {model && (
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>ENGINE STATUS</div>
              {[
                ["Observable dim", model.d],
                ["Residual σ", (model.residStd * model.std[0]).toFixed(4)],
                ["K operator", <span style={{ color: "#2ea043" }}>✓ FITTED</span>],
                ["Data source", <span style={{ color: sourceColor }}>{dataSource}</span>],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#8b949e" }}>{label}</span>
                  <span style={{ fontSize: 10, color: "#e6edf3" }}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* Tab Nav */}
          <div style={{ borderBottom: "1px solid #21262d", padding: "0 28px", display: "flex" }}>
            {[
              { id: "forecast", label: "FORECAST" },
              { id: "compare",  label: "COMPARE LANES" },
              { id: "scenario", label: "SCENARIO" },
              { id: "fuel",     label: "FUEL IMPACT" },
            ].map(t => (
              <button key={t.id} className={`tab-btn ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div style={{ padding: "20px 28px", flex: 1, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
            {activeTab === "forecast" && (
              <ForecastTab quote={quote} trajectory={trajectory} horizon={horizon} lane={lane} />
            )}
            {activeTab === "compare" && (
              <CompareTab state={state} horizon={horizon} margin={margin} lane={lane} />
            )}
            {activeTab === "scenario" && (
              <ScenarioTab model={model} state={state} horizon={horizon} margin={margin} quote={quote} trajectory={trajectory} />
            )}
            {activeTab === "fuel" && (
              <FuelTab model={model} state={state} horizon={horizon} margin={margin} quote={quote} />
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          config={apiConfig}
          onChange={cfg => { setApiConfig(cfg); setTestStatus({ market: null, historical: null }); }}
          onClose={() => setShowSettings(false)}
          onTest={testConnection}
          testStatus={testStatus}
        />
      )}
    </div>
  );
}
