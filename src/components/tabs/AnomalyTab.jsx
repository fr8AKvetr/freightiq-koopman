import { useState } from "react";

const SCORE_COLOR = (score) => {
  if (score >= 0.85) return "#f85149";
  if (score >= 0.6)  return "#d29922";
  return "#2ea043";
};

const SCORE_LABEL = (score) => {
  if (score >= 0.85) return "CRITICAL";
  if (score >= 0.6)  return "ELEVATED";
  return "NORMAL";
};

export default function AnomalyTab({ lane, state, horizon, margin, backendUrl }) {
  const [carrierDot, setCarrierDot] = useState("");
  const [carrierRate, setCarrierRate] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const canRun = carrierDot.trim() && carrierRate && !isNaN(parseFloat(carrierRate)) && backendUrl;

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const url = `${backendUrl.replace(/\/$/, "")}/api/anomaly`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lane,
          carrier_dot: carrierDot.trim(),
          carrier_rate: parseFloat(carrierRate),
          state,
          horizon,
          margin,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportSignal = () => {
    if (!result) return;
    const signal = {
      signal_type: "rate_anomaly",
      lane: result.lane,
      carrier_dot: result.carrier_dot,
      carrier_rate: parseFloat(carrierRate),
      model_rate: result.model_rate,
      deviation_pct: result.deviation_pct,
      anomaly_score: result.anomaly_score,
      horizon,
      ts: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(signal, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 6 }}>CARRIER RATE ANOMALY DETECTION</div>
        <div style={{ fontSize: 11, color: "#8b949e" }}>
          Compare a carrier's quoted rate against the Koopman model forecast. Scores ≥ 0.85 indicate potential fraud or double-brokering.
        </div>
      </div>

      {/* Input Row */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 9, color: "#484f58", letterSpacing: 2 }}>CARRIER DOT #</span>
          <input
            type="text"
            value={carrierDot}
            onChange={e => setCarrierDot(e.target.value)}
            placeholder="e.g. 123456"
            style={{
              background: "#0d1117", border: "1px solid #30363d", borderRadius: 4,
              color: "#e6edf3", fontFamily: "inherit", fontSize: 12, padding: "8px 12px",
              width: 140,
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 9, color: "#484f58", letterSpacing: 2 }}>CARRIER RATE ($/mi)</span>
          <input
            type="number"
            value={carrierRate}
            onChange={e => setCarrierRate(e.target.value)}
            placeholder="e.g. 1.45"
            step="0.01"
            min="0.5"
            max="8.0"
            style={{
              background: "#0d1117", border: "1px solid #30363d", borderRadius: 4,
              color: "#e6edf3", fontFamily: "inherit", fontSize: 12, padding: "8px 12px",
              width: 140,
            }}
          />
        </div>
        <button
          disabled={!canRun || loading}
          onClick={runCheck}
          style={{
            background: canRun && !loading ? "#1a3a5c" : "#161b22",
            border: `1px solid ${canRun && !loading ? "#58a6ff" : "#21262d"}`,
            color: canRun && !loading ? "#58a6ff" : "#484f58",
            padding: "8px 20px", borderRadius: 4, cursor: canRun && !loading ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontSize: 11, letterSpacing: 1, transition: "all 0.15s",
          }}
        >
          {loading ? "CHECKING..." : "CHECK ANOMALY"}
        </button>
        {!backendUrl && (
          <span style={{ fontSize: 10, color: "#d29922", alignSelf: "center" }}>
            ⚠ Set backend URL in ⚙ API settings
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#1a0a0a", border: "1px solid #3d1a1a", borderRadius: 4, padding: "10px 14px" }}>
          <span style={{ fontSize: 11, color: "#f85149" }}>⚠  {error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Score Banner */}
          <div style={{
            background: result.is_anomalous ? "#1a0a0a" : "#0a1a0a",
            border: `1px solid ${result.is_anomalous ? "#f85149" : "#2ea043"}`,
            borderRadius: 6, padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 6 }}>ANOMALY VERDICT</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: result.is_anomalous ? "#f85149" : "#2ea043" }}>
                {result.is_anomalous ? "⚠ ANOMALOUS" : "✓ NORMAL"}
              </div>
              <div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>
                DOT #{result.carrier_dot} · {result.lane}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 6 }}>ANOMALY SCORE</div>
              <div style={{ fontSize: 36, fontWeight: 600, color: SCORE_COLOR(result.anomaly_score), lineHeight: 1 }}>
                {result.anomaly_score.toFixed(2)}
              </div>
              <div style={{ fontSize: 9, color: SCORE_COLOR(result.anomaly_score), letterSpacing: 1, marginTop: 4 }}>
                {SCORE_LABEL(result.anomaly_score)}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              ["CARRIER RATE", `$${parseFloat(carrierRate).toFixed(3)}/mi`, "#e6edf3"],
              ["MODEL RATE", `$${result.model_rate.toFixed(3)}/mi`, "#58a6ff"],
              ["DEVIATION", `${result.deviation_pct >= 0 ? "+" : ""}${result.deviation_pct.toFixed(1)}%`,
                result.deviation_pct < -15 || result.deviation_pct > 15 ? "#f85149" : "#2ea043"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "14px 16px" }}>
                <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Export */}
          {result.is_anomalous && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={exportSignal}
                style={{
                  background: "#1a0d00", border: "1px solid #d29922", color: "#d29922",
                  padding: "8px 18px", borderRadius: 4, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 11, letterSpacing: 1,
                }}
              >
                {copied ? "✓ COPIED" : "⬆ EXPORT CARRIERSENTIAL SIGNAL"}
              </button>
              <span style={{ fontSize: 10, color: "#484f58" }}>copies JSON to clipboard</span>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
