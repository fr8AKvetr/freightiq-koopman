export default function Sparkline({ data, width = 64, height = 22, color = "#58a6ff" }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.rate);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 0.01;
  const pts = vals.map((v, i) =>
    `${(i / (vals.length - 1)) * width},${(height - 2) - ((v - min) / range) * (height - 4) + 1}`
  ).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
