/**
 * Radar « profil de vigilance » au niveau DOSSIER (V7, recadré). Trois axes
 * RÉELLEMENT calculables (structure, exposition sanctions, opacité de détention).
 * Échelle et palette NEUTRES — distinctes du radar secteur. Indicateur
 * d'orientation, jamais un verdict : aucune mention « Critique ». Composant
 * serveur, pur SVG (valeurs 0-100 calculées en amont).
 */
export type RadarAxis = { label: string; value: number };

export default function VigilanceRadar({
  axes,
  size = 200,
  color = "var(--primary)",
}: {
  axes: RadarAxis[];
  size?: number;
  color?: string;
}) {
  const N = axes.length;
  if (N < 3) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 30;
  const ang = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt = (i: number, r: number): [number, number] => [
    cx + Math.cos(ang(i)) * r,
    cy + Math.sin(ang(i)) * r,
  ];
  const clampPct = (v: number) => Math.max(0, Math.min(100, v));
  const rings = [0.25, 0.5, 0.75, 1];
  const valPts = axes.map((a, i) => pt(i, (R * clampPct(a.value)) / 100));

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ overflow: "visible" }}
      role="img"
      aria-label="Profil de vigilance du dossier (structure, sanctions, détention)"
    >
      {rings.map((rr, idx) => (
        <polygon
          key={idx}
          points={axes.map((_, i) => pt(i, R * rr).join(",")).join(" ")}
          fill="none"
          stroke="rgba(148,163,184,0.18)"
          strokeWidth="1"
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(148,163,184,0.16)"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        points={valPts.map((q) => q.join(",")).join(" ")}
        fill={color}
        fillOpacity="0.16"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {valPts.map((q, i) => (
        <circle key={i} cx={q[0]} cy={q[1]} r="3" fill={color} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 18);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end"}
            dominantBaseline="middle"
            fontSize="10"
            fontWeight="600"
            fill="var(--muted-foreground)"
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}
