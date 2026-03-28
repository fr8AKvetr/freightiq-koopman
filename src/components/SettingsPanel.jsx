import { useState } from "react";
import { STATE_FIELDS } from "../constants.js";

export default function SettingsPanel({ config, onChange, onClose, onTest, testStatus }) {
  const [draft, setDraft] = useState(config);
  const set = (key, val) => setDraft(d => ({ ...d, [key]: val }));
  const setFieldMap = (internal, external) =>
    setDraft(d => ({ ...d, fieldMap: { ...d.fieldMap, [internal]: external } }));
  const save = () => { onChange(draft); onClose(); };

  const inputStyle = {
    background: "#0a0d14", border: "1px solid #30363d", borderRadius: 3,
    color: "#e6edf3", fontSize: 11, padding: "5px 8px", width: "100%",
    fontFamily: "'IBM Plex Mono', monospace", outline: "none",
  };
  const labelStyle = { fontSize: 10, color: "#8b949e", marginBottom: 4, display: "block" };
  const sectionStyle = { background: "#0d1117", border: "1px solid #21262d", borderRadius: 4, padding: "14px 16px" };
  const toggleStyle = (on) => ({
    width: 28, height: 14, borderRadius: 7, background: on ? "#1a7f4e" : "#21262d",
    position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.15s",
  });
  const thumbStyle = (on) => ({
    position: "absolute", top: 2, left: on ? 14 : 2, width: 10, height: 10,
    borderRadius: "50%", background: on ? "#2ea043" : "#484f58", transition: "left 0.15s",
  });
  const statusColor = (s) => s === "ok" ? "#2ea043" : s === "error" ? "#f85149" : s === "testing" ? "#d29922" : "#484f58";
  const statusLabel = (s) => s === "ok" ? "CONNECTED" : s === "error" ? "FAILED" : s === "testing" ? "TESTING..." : "UNTESTED";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div style={{ width: 480, background: "#161b22", borderLeft: "1px solid #21262d", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ borderBottom: "1px solid #21262d", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e6edf3", letterSpacing: 1 }}>API SETTINGS</div>
            <div style={{ fontSize: 10, color: "#484f58", marginTop: 2 }}>Configure live data sources for the Koopman engine</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <div style={sectionStyle}>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 12 }}>RATESENTINEL BACKEND</div>
            <div>
              <label style={labelStyle}>Backend URL (Railway)</label>
              <input style={inputStyle} placeholder="https://your-app.railway.app" value={draft.backendUrl || ""} onChange={e => set("backendUrl", e.target.value)} />
              <div style={{ fontSize: 9, color: "#484f58", marginTop: 4 }}>Used by the Anomaly tab to call POST /api/anomaly</div>
            </div>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 12 }}>AUTHENTICATION</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={labelStyle}>API Key</label>
                <input type="password" style={inputStyle} placeholder="sk-..." value={draft.apiKey} onChange={e => set("apiKey", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Key Header</label>
                  <input style={inputStyle} placeholder="Authorization" value={draft.apiKeyHeader} onChange={e => set("apiKeyHeader", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Key Prefix</label>
                  <input style={inputStyle} placeholder="Bearer " value={draft.apiKeyPrefix} onChange={e => set("apiKeyPrefix", e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Lane Query Param</label>
                <input style={inputStyle} placeholder="lane" value={draft.laneParam} onChange={e => set("laneParam", e.target.value)} />
                <div style={{ fontSize: 9, color: "#484f58", marginTop: 3 }}>Appended as ?{draft.laneParam || "lane"}=DAL-LAX on each request</div>
              </div>
            </div>
          </div>
          {[
            { which: "market", label: "MARKET STATE API", urlKey: "marketStateUrl", enabledKey: "marketEnabled", placeholder: "https://api.example.com/v1/market/state", note: "Returns current market state object. Expected: JSON object with numeric fields." },
            { which: "historical", label: "HISTORICAL DATA API", urlKey: "historicalUrl", enabledKey: "historicalEnabled", placeholder: "https://api.example.com/v1/market/history", note: "Returns array of market state records. Also accepts ?days=180." },
          ].map(({ which, label, urlKey, enabledKey, placeholder, note }) => (
            <div key={which} style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2 }}>{label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, color: statusColor(testStatus[which]) }}>{statusLabel(testStatus[which])}</span>
                  <div style={toggleStyle(draft[enabledKey])} onClick={() => set(enabledKey, !draft[enabledKey])}>
                    <div style={thumbStyle(draft[enabledKey])} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: draft[enabledKey] ? 1 : 0.5 }}>
                <div>
                  <label style={labelStyle}>Endpoint URL</label>
                  <input style={inputStyle} placeholder={placeholder} value={draft[urlKey]} onChange={e => set(urlKey, e.target.value)} />
                  <div style={{ fontSize: 9, color: "#484f58", marginTop: 3 }}>{note}</div>
                </div>
                <button onClick={() => onTest(which, draft)} disabled={!draft[urlKey] || testStatus[which] === "testing"} style={{
                  background: "none", border: "1px solid #30363d", color: "#8b949e", padding: "5px 12px",
                  borderRadius: 3, cursor: "pointer", fontFamily: "inherit", fontSize: 10, alignSelf: "flex-start",
                  opacity: !draft[urlKey] ? 0.4 : 1,
                }}>TEST CONNECTION</button>
              </div>
            </div>
          ))}
          <div style={sectionStyle}>
            <div style={{ fontSize: 9, color: "#484f58", letterSpacing: 2, marginBottom: 4 }}>FIELD MAPPING</div>
            <div style={{ fontSize: 9, color: "#484f58", marginBottom: 12 }}>Map internal field names to your API response field names.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 14px 1fr", gap: "6px 4px", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: "#484f58" }}>INTERNAL FIELD</div>
              <div />
              <div style={{ fontSize: 9, color: "#484f58" }}>API FIELD NAME</div>
              {STATE_FIELDS.map(f => (
                <>
                  <div key={`l-${f.key}`} style={{ fontSize: 10, color: "#8b949e", padding: "4px 0" }}>{f.key}</div>
                  <div key={`a-${f.key}`} style={{ fontSize: 10, color: "#484f58", textAlign: "center" }}>→</div>
                  <input key={`i-${f.key}`} style={{ ...inputStyle, padding: "4px 6px" }}
                    value={draft.fieldMap[f.key] || ""} onChange={e => setFieldMap(f.key, e.target.value)} placeholder={f.key} />
                </>
              ))}
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #21262d", padding: "14px 20px", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #30363d", color: "#8b949e", padding: "8px 16px", borderRadius: 3, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>CANCEL</button>
          <button onClick={save} style={{ background: "#1a7f4e", border: "none", color: "#fff", padding: "8px 20px", borderRadius: 3, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>SAVE & APPLY</button>
        </div>
      </div>
    </div>
  );
}
