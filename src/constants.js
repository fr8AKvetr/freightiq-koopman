// ─── Constants ────────────────────────────────────────────────────────────────

export const LANES = ["DAL-LAX", "CHI-ATL", "NYC-MIA", "SEA-DEN", "HOU-DFW"];

export const MODE_COLORS = {
  "Seasonal":          "#f59e0b",
  "Capacity Cycle":    "#60a5fa",
  "Fuel Pass-Through": "#34d399",
  "Demand Shock":      "#f87171",
  "Contract Drift":    "#a78bfa",
};

export const STATE_FIELDS = [
  { key: "spot_rate",        label: "Spot Rate",        unit: "$/mi", min: 1.0,  max: 5.0,  step: 0.05 },
  { key: "ltr",              label: "Load/Truck Ratio", unit: "×",    min: 0.5,  max: 8.0,  step: 0.1  },
  { key: "fuel_index",       label: "Fuel Index",       unit: "",     min: 0.6,  max: 1.8,  step: 0.01 },
  { key: "cap_util",         label: "Capacity Util",    unit: "%",    min: 0.3,  max: 1.0,  step: 0.01 },
  { key: "days_since_shock", label: "Days Since Shock", unit: "d",    min: 0,    max: 90,   step: 1    },
  { key: "contract_spread",  label: "Contract Spread",  unit: "$/mi", min: -0.5, max: 1.0,  step: 0.01 },
  { key: "day_of_year",      label: "Day of Year",      unit: "",     min: 1,    max: 365,  step: 1    },
];

export const DEFAULT_API_CONFIG = {
  backendUrl: "",
  marketStateUrl: "", historicalUrl: "", apiKey: "",
  apiKeyHeader: "Authorization", apiKeyPrefix: "Bearer ", laneParam: "lane",
  marketEnabled: false, historicalEnabled: false,
  fieldMap: {
    spot_rate: "spot_rate", ltr: "ltr", fuel_index: "fuel_index",
    cap_util: "cap_util", days_since_shock: "days_since_shock",
    contract_spread: "contract_spread", day_of_year: "day_of_year",
  },
};

export const SCENARIO_PRESETS = [
  { label: "FUEL SPIKE +25%",  deltas: { fuel_index: 0.25, ltr: 0,    cap_util: 0,     spot_rate: 0 } },
  { label: "DEMAND SURGE",     deltas: { fuel_index: 0,    ltr: 2.0,  cap_util: 0.12,  spot_rate: 0 } },
  { label: "DEMAND COLLAPSE",  deltas: { fuel_index: 0,    ltr: -2.0, cap_util: -0.12, spot_rate: 0 } },
  { label: "CAPACITY CRUNCH",  deltas: { fuel_index: 0.1,  ltr: 1.5,  cap_util: 0.18,  spot_rate: 0 } },
  { label: "RESET",            deltas: { fuel_index: 0,    ltr: 0,    cap_util: 0,     spot_rate: 0 } },
];

export const SCENARIO_DELTA_FIELDS = [
  { key: "fuel_index", label: "Fuel Index Δ",    min: -0.5, max: 0.8,  step: 0.01, unit: "" },
  { key: "ltr",        label: "L/T Ratio Δ",     min: -4.0, max: 4.0,  step: 0.1,  unit: "×" },
  { key: "cap_util",   label: "Capacity Util Δ", min: -0.4, max: 0.3,  step: 0.01, unit: "%" },
  { key: "spot_rate",  label: "Spot Rate Δ",     min: -1.0, max: 1.0,  step: 0.05, unit: "$/mi" },
];

export const DIESEL_REF = 3.50;
export const TRUCK_MPG  = 6.5;

export const TOOLTIP_STYLE = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 4,
  fontFamily: "IBM Plex Mono",
  fontSize: 11,
};
