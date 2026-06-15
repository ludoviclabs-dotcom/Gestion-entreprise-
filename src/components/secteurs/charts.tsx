"use client";

/* Composants graphiques SVG (sans dépendance) pour la page Secteurs :
   useReveal · CountUp · RadarChart · Heatmap · ControlChain · RiskLegend. */
import { useEffect, useRef, useState } from "react";
import {
  DIMENSIONS,
  PALETTE,
  SECTORS,
  scoreColor,
  scoreLabel,
  type DimensionKey,
  type SectorPattern,
} from "@/lib/domain/sector-scoring";

/* ── Révélation au scroll (rect + scroll, robuste sans IntersectionObserver) ── */
export function useReveal(frac = 0.1): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const check = () => {
      if (done) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < vh * (1 - frac) && r.bottom > 0) {
        done = true;
        setShown(true);
        window.removeEventListener("scroll", check);
        window.removeEventListener("resize", check);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const id = window.setTimeout(check, 80);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.clearTimeout(id);
    };
  }, [frac]);
  return [ref, shown];
}

/* ── Compteur animé (count-up) — valeur finale par défaut (SSR), anime depuis 0 ── */
export function CountUp({
  to,
  dur = 1100,
  suffix = "",
  className,
  style,
}: {
  to: number;
  dur?: number;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [v, setV] = useState(to);
  useEffect(() => {
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return (
    <span className={className} style={style}>
      {v}
      {suffix}
    </span>
  );
}

/* ── RADAR : exposition d'un secteur sur les 5 dimensions ── */
export function RadarChart({
  scores,
  size = 224,
}: {
  scores: Record<DimensionKey, number>;
  size?: number;
}) {
  const dims = DIMENSIONS;
  const N = dims.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 34;
  // Démarre replié (0) et s'ouvre ; le radar n'est monté qu'au clic (jamais en SSR).
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / 850);
      setP(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ang = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt = (i: number, r: number): [number, number] => [
    cx + Math.cos(ang(i)) * r,
    cy + Math.sin(ang(i)) * r,
  ];
  const rings = [0.25, 0.5, 0.75, 1];
  const valPts = dims.map((d, i) => pt(i, R * (scores[d.key] / 100) * p));
  const avg = Math.round(dims.reduce((a, d) => a + scores[d.key], 0) / N);
  const stroke = scoreColor(avg);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ overflow: "visible" }}>
      {rings.map((rr, idx) => (
        <polygon
          key={idx}
          points={dims.map((_, i) => pt(i, R * rr).join(",")).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
      {dims.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
      })}
      <polygon
        points={valPts.map((q) => q.join(",")).join(" ")}
        fill={stroke}
        fillOpacity="0.16"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 10px ${stroke}55)` }}
      />
      {valPts.map((q, i) => (
        <circle key={i} cx={q[0]} cy={q[1]} r="3.4" fill={stroke} stroke={PALETTE.bg0} strokeWidth="1.5" />
      ))}
      {dims.map((d, i) => {
        const [x, y] = pt(i, R + 20);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end"}
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="600"
            fill={PALETTE.textMid}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {d.short}
          </text>
        );
      })}
    </svg>
  );
}

/* ── HEATMAP : secteurs (lignes) × dimensions (colonnes), interactive ── */
const headCell: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: PALETTE.textLow,
  fontFamily: "var(--font-display)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};
const labelCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "10px 12px",
  fontSize: 14,
  fontWeight: 500,
  fontFamily: "var(--font-display)",
  borderRadius: 7,
  transition: "background .15s, color .15s",
  cursor: "default",
};
const tooltip: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 8px)",
  left: "50%",
  transform: "translateX(-50%)",
  width: 230,
  padding: "10px 12px",
  background: "#11142a",
  border: `1px solid ${PALETTE.accent}66`,
  borderRadius: 10,
  fontSize: 12,
  lineHeight: 1.45,
  zIndex: 30,
  boxShadow: "0 18px 50px rgba(0,0,0,0.6)",
  pointerEvents: "none",
};

export function Heatmap({
  active,
  setActive,
}: {
  active: string | null;
  setActive: (s: string | null) => void;
}) {
  const dims = DIMENSIONS;
  const [hoverCell, setHoverCell] = useState<string | null>(null);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `minmax(210px, 1.5fr) repeat(${dims.length}, 1fr) 116px`,
          alignItems: "stretch",
          minWidth: 640,
        }}
      >
        <div style={headCell}>Secteur</div>
        {dims.map((d) => (
          <div key={d.key} style={{ ...headCell, textAlign: "center" }} title={d.desc}>
            {d.short}
          </div>
        ))}
        <div style={{ ...headCell, textAlign: "center" }}>Intensité</div>

        {SECTORS.map((s, ri) => {
          const isActive = active === s.slug;
          return (
            <div key={s.slug} style={{ display: "contents" }}>
              <div
                onMouseEnter={() => setActive(s.slug)}
                onMouseLeave={() => setActive(null)}
                style={{
                  ...labelCell,
                  background: isActive ? `${PALETTE.accent}1f` : "transparent",
                  color: isActive ? PALETTE.textHi : "#cdd2e6",
                }}
              >
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 11,
                    color: PALETTE.textLow,
                    marginRight: 10,
                  }}
                >
                  {s.n}
                </span>
                {s.sector}
              </div>
              {dims.map((d, ci) => {
                const v = s.scores[d.key];
                const c = scoreColor(v);
                const isHover = hoverCell === `${ri}-${ci}`;
                return (
                  <div
                    key={d.key}
                    onMouseEnter={() => {
                      setHoverCell(`${ri}-${ci}`);
                      setActive(s.slug);
                    }}
                    onMouseLeave={() => {
                      setHoverCell(null);
                      setActive(null);
                    }}
                    style={{ position: "relative", padding: 4, display: "flex" }}
                  >
                    <div
                      style={{
                        flex: 1,
                        borderRadius: 7,
                        minHeight: 46,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: `${c}${isHover ? "44" : isActive ? "2e" : "22"}`,
                        border: `1px solid ${c}${isHover ? "" : "3a"}`,
                        color: c,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 13,
                        fontWeight: 600,
                        transition: "background .15s, border-color .15s, box-shadow .15s",
                        boxShadow: isHover ? `0 0 18px ${c}55` : "none",
                        cursor: "default",
                      }}
                    >
                      {v}
                    </div>
                    {isHover && (
                      <div style={tooltip}>
                        <strong style={{ color: PALETTE.textHi }}>{d.label}</strong>
                        <span style={{ color: c, fontWeight: 700 }}>
                          {" "}
                          · {scoreLabel(v)} ({v})
                        </span>
                        <div style={{ color: PALETTE.textMid, marginTop: 4, fontWeight: 400 }}>{d.desc}</div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div
                style={{ padding: 4, display: "flex", alignItems: "center" }}
                onMouseEnter={() => setActive(s.slug)}
                onMouseLeave={() => setActive(null)}
              >
                <div
                  style={{
                    flex: 1,
                    height: 24,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.05)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${s.intensity}%`,
                      background: `linear-gradient(90deg, ${scoreColor(s.intensity)}aa, ${scoreColor(s.intensity)})`,
                      borderRadius: 6,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 11,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontWeight: 700,
                      color: PALETTE.bg0,
                    }}
                  >
                    {s.intensity}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── ControlChain : mini-schéma de chaîne de contrôle (signature par secteur) ── */
export function ControlChain({
  pattern,
  color = PALETTE.accent,
  w = 300,
  h = 150,
}: {
  pattern: SectorPattern;
  color?: string;
  w?: number;
  h?: number;
}) {
  const soft = PALETTE.accentSoft;
  const node = (x: number, y: number, r: number, fill: string, key: string, ring?: boolean) => (
    <g key={key}>
      {ring && <circle cx={x} cy={y} r={r + 4} fill="none" stroke={fill} strokeOpacity="0.35" strokeWidth="1" />}
      <circle cx={x} cy={y} r={r} fill={fill} stroke={PALETTE.bg0} strokeWidth="1.5" />
    </g>
  );
  const edge = (x1: number, y1: number, x2: number, y2: number, key: string, dashed?: boolean) => (
    <line
      key={key}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={dashed ? "#f26d6d" : `${soft}8c`}
      strokeWidth="1.6"
      strokeDasharray={dashed ? "4 4" : "none"}
    />
  );
  let edges: React.ReactNode[] = [];
  let nodes: React.ReactNode[] = [];
  let caption = "";

  if (pattern === "cascade") {
    caption = "Holdings en cascade";
    const xs = [60, 110, 160, 210];
    edges = xs.slice(0, 3).map((x, i) => edge(x, 40 + i * 28, xs[i + 1], 40 + (i + 1) * 28, "e" + i));
    edges.push(edge(xs[3], 124, 252, 124, "ed", true));
    nodes = xs.map((x, i) => node(x, 40 + i * 28, i === 0 ? 9 : 7, i === 0 ? color : soft, "n" + i, i === 0));
    nodes.push(node(252, 124, 8, "#f26d6d", "tgt", true));
  } else if (pattern === "loop") {
    caption = "Boucle de détention";
    const c: [number, number][] = [
      [90, 50],
      [210, 50],
      [210, 110],
      [90, 110],
    ];
    edges = c.map((pp, i) => {
      const q = c[(i + 1) % 4];
      return edge(pp[0], pp[1], q[0], q[1], "e" + i);
    });
    nodes = c.map((pp, i) => node(pp[0], pp[1], 8, i === 0 ? color : soft, "n" + i, i === 0));
  } else if (pattern === "pivot") {
    caption = "Mandataire pivot multi-sociétés";
    const center: [number, number] = [150, 80];
    const ring: [number, number][] = [
      [60, 40],
      [240, 40],
      [60, 120],
      [240, 120],
      [150, 30],
    ];
    edges = ring.map((pp, i) => edge(center[0], center[1], pp[0], pp[1], "e" + i));
    nodes = ring.map((pp, i) => node(pp[0], pp[1], 7, soft, "n" + i));
    nodes.push(node(center[0], center[1], 11, color, "c", true));
  } else if (pattern === "fan") {
    caption = "Dépendance supply-chain";
    const root: [number, number] = [54, 80];
    const tips: [number, number][] = [
      [230, 36],
      [248, 70],
      [248, 104],
      [230, 124],
      [200, 26],
    ];
    edges = tips.map((pp, i) => edge(root[0], root[1], pp[0], pp[1], "e" + i, i === 1));
    nodes = tips.map((pp, i) => node(pp[0], pp[1], 7, i === 1 ? "#f26d6d" : soft, "n" + i, i === 1));
    nodes.push(node(root[0], root[1], 11, color, "r", true));
  } else {
    caption = "Chaîne d'intermédiaires";
    const xs = [50, 100, 150, 200, 250];
    const ys = [70, 100, 60, 105, 70];
    edges = xs.slice(0, 4).map((x, i) => edge(x, ys[i], xs[i + 1], ys[i + 1], "e" + i, i === 3));
    nodes = xs.map((x, i) =>
      node(x, ys[i], i === 0 ? 10 : 7, i === 0 ? color : i === 4 ? "#f26d6d" : soft, "n" + i, i === 0 || i === 4),
    );
  }

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
        {edges}
        {nodes}
      </svg>
      <div
        style={{
          fontSize: 11,
          color: PALETTE.textLow,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          marginTop: 2,
        }}
      >
        {caption}
      </div>
    </div>
  );
}

/* ── Légende risque ── */
export function RiskLegend() {
  const items: [string, string, string][] = [
    ["Maîtrisé", "#4ade9b", "<48"],
    ["Modéré", "#f5b544", "48-63"],
    ["Élevé", "#ff9248", "64-77"],
    ["Critique", "#f26d6d", "≥78"],
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {items.map(([l, c, r]) => (
        <div key={l} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: c }} />
          <span style={{ fontSize: 12.5, color: "#cdd2e6", fontWeight: 500 }}>{l}</span>
          <span style={{ fontSize: 11, color: PALETTE.textLow, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            {r}
          </span>
        </div>
      ))}
    </div>
  );
}
