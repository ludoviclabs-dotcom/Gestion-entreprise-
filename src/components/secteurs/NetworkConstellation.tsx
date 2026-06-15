"use client";

/* Constellation réseau — orbe filaire (latitudes + méridiens en rotation),
   nœuds de secteurs sur la surface, hubs de dimensions au cœur, liens courbes
   avec paquets de données animés. Survol = mise en lumière. */
import { useEffect, useRef, useState } from "react";
import {
  DIMENSIONS,
  PALETTE,
  SECTORS,
  scoreColor,
  type DimensionKey,
} from "@/lib/domain/sector-scoring";

const ACCENT = PALETTE.accent;
const ACCENT_SOFT = PALETTE.accentSoft;
const ACCENT_DEEP = "#0c3b39";
const ACCENT_TEXT = "#aef0e8";

/** Point sur une courbe de Bézier quadratique. */
function qbez(
  p: number,
  x0: number,
  y0: number,
  cxp: number,
  cyp: number,
  x1: number,
  y1: number,
): [number, number] {
  const u = 1 - p;
  return [u * u * x0 + 2 * u * p * cxp + p * p * x1, u * u * y0 + 2 * u * p * cyp + p * p * y1];
}

export function NetworkConstellation({
  active,
  setActive,
  width = 560,
  height = 480,
}: {
  active: string | null;
  setActive: (s: string | null) => void;
  width?: number;
  height?: number;
}) {
  const [t, setT] = useState(0);
  const [hub, setHub] = useState<DimensionKey | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    let mounted = true;
    const loop = () => {
      if (!mounted) return;
      setT((x) => x + 0.0125);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const cx = width / 2;
  const cy = height / 2;
  const Ro = Math.min(width, height) / 2 - 52;
  const Ri = Ro * 0.34;

  const hubPos = DIMENSIONS.map((d, i) => {
    const a = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2 + t * 0.12;
    const wob = Math.sin(t * 0.9 + i) * 3;
    return { ...d, x: cx + Math.cos(a) * (Ri + wob), y: cy + Math.sin(a) * (Ri + wob) * 0.86 };
  });

  const secPos = SECTORS.map((s, i) => {
    const a = (Math.PI * 2 * i) / SECTORS.length - Math.PI / 2 - t * 0.07;
    const wob = Math.sin(t * 0.8 + i * 1.3) * 4;
    const depth = Math.sin(a + t * 0.07);
    return { ...s, a, x: cx + Math.cos(a) * (Ro + wob), y: cy + Math.sin(a) * (Ro + wob) * 0.92, depth };
  });

  type Edge = {
    s: (typeof secPos)[number];
    hb: (typeof hubPos)[number];
    v: number;
    lit: boolean;
    dim: boolean;
    key: string;
  };
  const edges: Edge[] = [];
  secPos.forEach((s) => {
    hubPos.forEach((hb) => {
      const v = s.scores[hb.key];
      if (v < 48) return;
      const litBySector = active === s.slug;
      const litByHub = hub === hb.key;
      const dimd = (!!active || !!hub) && !litBySector && !litByHub;
      edges.push({ s, hb, v, lit: litBySector || litByHub, dim: dimd, key: s.slug + hb.key });
    });
  });
  edges.sort((a, b) => (a.lit === b.lit ? 0 : a.lit ? 1 : -1));

  const meridians = [];
  for (let i = 0; i < 6; i++) {
    const phase = (Math.PI * i) / 6 + t * 0.22;
    const rx = Math.abs(Math.cos(phase)) * Ro;
    const op = 0.05 + Math.abs(Math.cos(phase)) * 0.1;
    meridians.push(
      <ellipse key={"m" + i} cx={cx} cy={cy} rx={rx} ry={Ro} fill="none" stroke={ACCENT} strokeOpacity={op} strokeWidth="1" />,
    );
  }
  const latitudes = [];
  for (let j = -2; j <= 2; j++) {
    const lat = j * 0.36;
    const yy = cy + Math.sin(lat) * Ro;
    const rx = Math.cos(lat) * Ro;
    const ry = Math.cos(lat) * Ro * 0.14;
    latitudes.push(
      <ellipse key={"l" + j} cx={cx} cy={yy} rx={rx} ry={ry} fill="none" stroke={ACCENT} strokeOpacity="0.09" strokeWidth="1" />,
    );
  }

  const anyLit = !!(active || hub);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>
      <defs>
        <radialGradient id="orbBody" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.20" />
          <stop offset="45%" stopColor={ACCENT_DEEP} stopOpacity="0.10" />
          <stop offset="100%" stopColor={PALETTE.bg0} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT_SOFT} stopOpacity="0.45" />
          <stop offset="55%" stopColor={ACCENT} stopOpacity="0.10" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={Ro + 6} fill="url(#orbBody)" />
      <g style={{ transition: "opacity .3s", opacity: anyLit ? 0.5 : 1 }}>
        {latitudes}
        {meridians}
      </g>
      <circle cx={cx} cy={cy} r={Ro} fill="none" stroke={ACCENT_SOFT} strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={Ri + 30} fill="url(#coreGlow)" />

      {edges.map((e) => {
        const c = scoreColor(e.v);
        const mx = (e.s.x + e.hb.x) / 2;
        const my = (e.s.y + e.hb.y) / 2;
        const cpx = mx + (cx - mx) * 0.18 + Math.sin(t + e.v) * (e.lit ? 5 : 1.5);
        const cpy = my + (cy - my) * 0.18 + Math.cos(t + e.v) * (e.lit ? 5 : 1.5);
        const d = `M ${e.s.x} ${e.s.y} Q ${cpx} ${cpy} ${e.hb.x} ${e.hb.y}`;
        const baseOp = e.dim ? 0.04 : e.lit ? 0.5 : 0.16;
        const flowOp = e.dim ? 0.06 : e.lit ? 1 : 0.32 + (e.v - 48) / 200;
        const seed = (e.v % 7) / 7;
        return (
          <g key={e.key}>
            <path d={d} fill="none" stroke={ACCENT_SOFT} strokeOpacity={baseOp} strokeWidth={e.lit ? 1.6 : 1} strokeLinecap="round" />
            <path
              d={d}
              fill="none"
              stroke={c}
              strokeOpacity={flowOp}
              strokeWidth={e.lit ? 2 : 1.2}
              strokeLinecap="round"
              strokeDasharray={e.lit ? "0.5 7" : "0.5 9"}
              strokeDashoffset={-(t * 42 + seed * 30)}
              style={{ filter: e.lit ? "url(#soft)" : "none" }}
            />
            {e.lit &&
              [0, 0.5].map((off, k) => {
                const pp = (t * 0.16 + seed + off) % 1;
                const [px, py] = qbez(pp, e.s.x, e.s.y, cpx, cpy, e.hb.x, e.hb.y);
                return <circle key={k} cx={px} cy={py} r="2.4" fill={c} style={{ filter: "url(#soft)" }} />;
              })}
          </g>
        );
      })}

      {hubPos.map((hb) => {
        const litByHub = hub === hb.key;
        const litBySector = !!active && (SECTORS.find((s) => s.slug === active)?.scores[hb.key] ?? 0) >= 48;
        const lit = litByHub || litBySector;
        const dimd = anyLit && !lit;
        return (
          <g
            key={hb.key}
            style={{ cursor: "pointer", opacity: dimd ? 0.3 : 1, transition: "opacity .25s" }}
            onMouseEnter={() => setHub(hb.key)}
            onMouseLeave={() => setHub(null)}
          >
            {litByHub && <circle cx={hb.x} cy={hb.y} r="13" fill={ACCENT_SOFT} fillOpacity="0.14" />}
            <circle
              cx={hb.x}
              cy={hb.y}
              r={litByHub ? 7.5 : 5.5}
              fill="#0c0e1d"
              stroke={ACCENT_SOFT}
              strokeWidth="1.5"
              style={{ filter: lit ? "url(#soft)" : "none" }}
            />
            <circle cx={hb.x} cy={hb.y} r="2.3" fill={ACCENT_SOFT} />
            <text
              x={hb.x}
              y={hb.y - 13}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill={lit ? ACCENT_TEXT : "#7d8fab"}
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                textTransform: "uppercase",
                letterSpacing: ".05em",
                pointerEvents: "none",
              }}
            >
              {hb.short}
            </text>
          </g>
        );
      })}

      {secPos.map((s) => {
        const isActive = active === s.slug;
        const litByHub = !!hub && s.scores[hub] >= 48;
        const lit = isActive || litByHub;
        const dimd = anyLit && !lit;
        const c = scoreColor(s.intensity);
        const depthScale = 0.82 + (s.depth + 1) * 0.12;
        const r = (isActive ? 14 : 10 + s.intensity / 34) * depthScale;
        const lx = s.x + Math.cos(s.a) * 24;
        const ly = s.y + Math.sin(s.a) * 24;
        const anchor = Math.abs(Math.cos(s.a)) < 0.34 ? "middle" : Math.cos(s.a) > 0 ? "start" : "end";
        return (
          <g
            key={s.slug}
            style={{ cursor: "pointer", opacity: dimd ? 0.26 : 0.55 + (s.depth + 1) * 0.22, transition: "opacity .25s" }}
            onMouseEnter={() => setActive(s.slug)}
            onMouseLeave={() => setActive(null)}
          >
            {lit && <circle cx={s.x} cy={s.y} r={r + 9} fill="none" stroke={c} strokeOpacity="0.45" strokeWidth="1" />}
            {lit && <circle cx={s.x} cy={s.y} r={r + 4} fill={c} fillOpacity="0.12" />}
            <circle cx={s.x} cy={s.y} r={r} fill="#0b0d1b" stroke={c} strokeWidth={isActive ? 2.4 : 1.7} style={{ filter: lit ? "url(#soft)" : "none" }} />
            <circle cx={s.x} cy={s.y} r={r} fill={c} fillOpacity="0.14" />
            <text
              x={s.x}
              y={s.y + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10 * depthScale}
              fontWeight="700"
              fill={c}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", pointerEvents: "none" }}
            >
              {s.n}
            </text>
            {lit && (
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize="11.5"
                fontWeight="600"
                fill={PALETTE.textHi}
                style={{ fontFamily: "var(--font-display)", pointerEvents: "none" }}
              >
                {s.sector.split(",")[0].split(" & ")[0].split(" et ")[0]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
