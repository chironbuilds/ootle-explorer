/** Dependency-free SVG sparkline: an area + line rendering of a numeric series. Used for the
 * live transaction pulse on the overview page; kept generic so other stats can reuse it. */
export function Sparkline({
  data,
  width = 220,
  height = 40,
  color = "var(--accent)",
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (data.length < 2) return <svg width={width} height={height} className={className} />;

  const max = Math.max(...data, 1);
  const pad = 2;
  const step = (width - pad * 2) / (data.length - 1);
  const y = (v: number) => pad + (1 - v / max) * (height - pad * 2);
  const points = data.map((v, i) => [pad + i * step, y(v)] as const);
  const line = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1]![0].toFixed(1)},${height} L${points[0]![0].toFixed(1)},${height} Z`;
  const gradientId = `spark-${color.replace(/[^a-z]/gi, "")}`;

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {/* Head dot -- marks the most recent sample */}
      <circle cx={points[points.length - 1]![0]} cy={points[points.length - 1]![1]} r="2.4" fill={color} />
    </svg>
  );
}
