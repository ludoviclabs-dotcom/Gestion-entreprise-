"use client";

import { Component, type CSSProperties } from "react";
import { ENT, PROOF, type GraphTheme, type Layout, type LNode, type Proof } from "./data";

/**
 * Graphe de démonstration sans cadre : dessin progressif à l'arrivée,
 * légère dérive, attraction des nœuds vers le curseur, survol = niveau de
 * preuve (+ liens mis en avant), clic / Entrée = sélection de la fiche.
 *
 * La boucle d'animation écrit directement les attributs SVG (pas de
 * re-render React par frame) ; seul l'état de survol passe par React.
 */

interface Props {
  layout: Layout;
  theme: GraphTheme;
  selected: string;
  onSelect: (id: string) => void;
  /** Le graphe n'anime que s'il appartient à la direction affichée. */
  active: boolean;
  attraction?: boolean;
  motion?: number;
}

interface State {
  hover: string | null;
}

type Pt = { x: number; y: number; r: number };
type Off = { x: number; y: number; ph: number };

const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);

function labelPos(n: LNode) {
  const o = n.r + 10;
  switch (n.side) {
    case "left":
      return { x: -o, ly: -1, cy: 12, a: "end" as const };
    case "top":
      return { x: 0, ly: -(n.r + 22), cy: -(n.r + 9), a: "middle" as const };
    case "bottom":
      return { x: 0, ly: n.r + 21, cy: n.r + 34, a: "middle" as const };
    default:
      return { x: o, ly: -1, cy: 12, a: "start" as const };
  }
}

/** Segment entre deux cercles, tracé sur la fraction `p` (dessin progressif). */
function seg(el: SVGLineElement, a: Pt, b: Pt, p: number, pad: number) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const x1 = a.x + ux * (a.r + pad), y1 = a.y + uy * (a.r + pad);
  const x2 = b.x - ux * (b.r + pad), y2 = b.y - uy * (b.r + pad);
  el.setAttribute("x1", x1.toFixed(1));
  el.setAttribute("y1", y1.toFixed(1));
  el.setAttribute("x2", (x1 + (x2 - x1) * p).toFixed(1));
  el.setAttribute("y2", (y1 + (y2 - y1) * p).toFixed(1));
}

export default class KybGraph extends Component<Props, State> {
  state: State = { hover: null };

  private g: Record<string, SVGGElement | null> = {};
  private e: Record<string, SVGLineElement | null> = {};
  private el: Record<string, SVGTextElement | null> = {};
  private ap: Record<string, SVGCircleElement | null> = {};
  private al: Record<string, SVGLineElement | null> = {};
  private off: Record<string, Off> = {};
  private cur: { cx: number; cy: number } | null = null;
  private vis = true;
  private last: string | null = null;
  private reduce = false;
  private t0 = 0;
  private raf = 0;
  private io?: IntersectionObserver;
  private svg: SVGSVGElement | null = null;
  private wrap: HTMLDivElement | null = null;
  private tip: HTMLDivElement | null = null;

  private onMove = (ev: PointerEvent) => {
    this.cur = { cx: ev.clientX, cy: ev.clientY };
  };
  private onOut = (ev: PointerEvent) => {
    if (!ev.relatedTarget) this.cur = null;
  };

  componentDidMount() {
    this.reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.t0 = performance.now();
    window.addEventListener("pointermove", this.onMove, { passive: true });
    document.addEventListener("pointerout", this.onOut);
    if ("IntersectionObserver" in window && this.wrap) {
      this.io = new IntersectionObserver((es) => {
        this.vis = es[0].isIntersecting;
      });
      this.io.observe(this.wrap);
    }
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (this.vis && this.props.active) this.tick(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  componentDidUpdate(prev: Props) {
    // Rejoue le dessin d'entrée quand la direction redevient visible.
    if (!prev.active && this.props.active) {
      this.t0 = performance.now();
      this.off = {};
    }
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointermove", this.onMove);
    document.removeEventListener("pointerout", this.onOut);
    this.io?.disconnect();
  }

  private tick(now: number) {
    const L = this.props.layout, m = this.props.motion ?? 1, svg = this.svg;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const t = (now - this.t0) / 1000, red = this.reduce;
    let c: { x: number; y: number } | null = null;
    if (this.cur && this.props.attraction !== false && !red) {
      const inv = ctm.inverse();
      c = {
        x: inv.a * this.cur.cx + inv.c * this.cur.cy + inv.e,
        y: inv.b * this.cur.cx + inv.d * this.cur.cy + inv.f,
      };
    }
    const reach = L.reach, cap = 24 * m, fl = red ? 0 : 2.4 * m;
    const intro = (d: number) => (red ? 1 : easeOut(c01((t - d) / 0.75)));
    const step = (id: string, x0: number, y0: number, k: number) => {
      const o = this.off[id] || (this.off[id] = { x: 0, y: 0, ph: (x0 * 0.013 + y0 * 0.021) % 6.283 });
      let tx = Math.sin(t * 0.55 + o.ph) * fl * k, ty = Math.cos(t * 0.47 + o.ph * 1.7) * fl * k;
      if (c) {
        const vx = c.x - x0, vy = c.y - y0, d = Math.hypot(vx, vy);
        if (d < reach && d > 0.5) {
          const f = Math.pow(1 - d / reach, 2) * 0.35;
          let ax = vx * f, ay = vy * f;
          const mm = Math.hypot(ax, ay), cc = cap * k;
          if (mm > cc) {
            ax *= cc / mm;
            ay *= cc / mm;
          }
          tx += ax;
          ty += ay;
        }
      }
      o.x += (tx - o.x) * 0.075;
      o.y += (ty - o.y) * 0.075;
      return { x: x0 + o.x, y: y0 + o.y };
    };

    const P: Record<string, Pt> = {};
    L.nodes.forEach((n) => {
      const p = { ...step(n.id, n.x, n.y, 1), r: n.r };
      P[n.id] = p;
      const g = this.g[n.id];
      if (g) {
        const s = intro(n.delay);
        g.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${(0.55 + 0.45 * s).toFixed(3)})`);
        g.setAttribute("opacity", s.toFixed(3));
      }
    });
    L.edges.forEach((e) => {
      const el = this.e[e.id];
      if (!el) return;
      const a = P[e.s], b = P[e.t];
      seg(el, a, b, intro(e.delay), 4);
      const lb = this.el[e.id];
      if (lb) {
        lb.setAttribute("x", ((a.x + b.x) / 2).toFixed(1));
        lb.setAttribute("y", ((a.y + b.y) / 2 - 6).toFixed(1));
      }
    });
    if (L.amb) {
      const AP: Record<string, Pt> = {};
      L.amb.pts.forEach((q) => {
        const p = { ...step(q.id, q.x, q.y, 0.8), r: q.r };
        AP[q.id] = p;
        const el = this.ap[q.id];
        if (el) {
          el.setAttribute("cx", p.x.toFixed(1));
          el.setAttribute("cy", p.y.toFixed(1));
          el.setAttribute("opacity", intro(q.delay).toFixed(2));
        }
      });
      L.amb.links.forEach((l) => {
        const el = this.al[l.id];
        if (el) seg(el, AP[l.s], AP[l.t], intro(l.delay), 3);
      });
    }

    const hv = this.state.hover;
    if (hv && this.tip && this.wrap && P[hv]) {
      const p = P[hv], wr = this.wrap.getBoundingClientRect();
      const sx = ctm.a * p.x + ctm.c * p.y + ctm.e - wr.left;
      const sy = ctm.b * p.x + ctm.d * p.y + ctm.f - wr.top;
      const rr = p.r * ctm.a + 16;
      const flip = sx > wr.width - 300;
      this.tip.style.transform = `translate(${(flip ? sx - rr : sx + rr).toFixed(1)}px,${sy.toFixed(1)}px) translate(${flip ? "-100%" : "0"},-50%)`;
    }
  }

  private enter(id: string) {
    this.last = id;
    this.setState({ hover: id });
  }

  private leave = () => this.setState({ hover: null });

  render() {
    const { layout: L, theme: T, selected: sel, onSelect } = this.props;
    const hv = this.state.hover;

    const adj: Record<string, 1> = {};
    if (hv) {
      adj[hv] = 1;
      L.edges.forEach((e) => {
        if (e.s === hv || e.t === hv) {
          adj[e.s] = 1;
          adj[e.t] = 1;
        }
      });
    }

    const edgeStyle = (p: Proof) =>
      ({
        confirme: { stroke: T.ink, strokeWidth: 1.4 },
        declare: { stroke: T.line, strokeWidth: 1.1 },
        infere: { stroke: T.warn, strokeWidth: 1.4, strokeDasharray: "5 4" },
        simule: { stroke: T.ink2, strokeWidth: 1.5, strokeDasharray: "1 4", strokeLinecap: "round" as const },
      })[p];
    const nodeStyle = (n: LNode) =>
      n.main
        ? { fill: T.accent }
        : {
            confirme: { fill: T.ink },
            declare: { fill: T.bg, stroke: T.ink, strokeWidth: 1.5 },
            infere: { fill: T.bg, stroke: T.warn, strokeWidth: 1.6, strokeDasharray: "3 2.4" },
            simule: { fill: T.bg, stroke: T.ink2, strokeWidth: 1.6, strokeDasharray: "1 3", strokeLinecap: "round" as const },
          }[n.proof];
    const halo = { paintOrder: "stroke" as const, stroke: T.bg, strokeWidth: 5, strokeLinejoin: "round" as const };

    const shown = hv || this.last;
    const tn = shown ? L.by[shown] : null;
    const te = shown ? ENT[shown] : null;
    const pr = tn ? PROOF[tn.proof] : null;
    const swatch = (p: Proof) =>
      ({
        confirme: `1.6px solid ${T.ink}`,
        declare: `1px solid ${T.line}`,
        infere: `1.6px dashed ${T.warn}`,
        simule: `2px dotted ${T.ink2}`,
      })[p];

    const tipStyle: CSSProperties = {
      position: "absolute", left: 0, top: 0, pointerEvents: "none", opacity: hv ? 1 : 0, transition: "opacity .18s",
      background: T.tipBg, color: T.ink, padding: "10px 12px", borderRadius: 4, boxShadow: T.tipShadow,
      fontFamily: T.mono, fontSize: 11.5, lineHeight: 1.55, whiteSpace: "nowrap", zIndex: 3,
    };

    return (
      <div ref={(el) => { this.wrap = el; }} style={{ position: "absolute", inset: 0 }}>
        <svg
          ref={(el) => { this.svg = el; }}
          viewBox={`0 0 ${L.w} ${L.h}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          height="100%"
          style={{ display: "block", overflow: "visible" }}
        >
          {L.amb && (
            <g style={{ pointerEvents: "none" }} aria-hidden>
              {L.amb.links.map((l) => (
                <line key={l.id} ref={(el) => { this.al[l.id] = el; }} stroke={T.line} strokeWidth={0.7} strokeOpacity={T.ambEdge} />
              ))}
              {L.amb.pts.map((q) => (
                <circle key={q.id} ref={(el) => { this.ap[q.id] = el; }} cx={q.x} cy={q.y} r={q.r} fill={T.ink} fillOpacity={T.ambNode} opacity={0} />
              ))}
            </g>
          )}

          <g>
            {L.edges.map((e) => {
              const on = !hv || e.s === hv || e.t === hv;
              const s = L.by[e.s];
              return (
                <line
                  key={e.id}
                  ref={(el) => { this.e[e.id] = el; }}
                  x1={s.x} y1={s.y} x2={s.x} y2={s.y}
                  style={{ opacity: on ? 1 : 0.16, transition: "opacity .25s" }}
                  {...edgeStyle(e.proof)}
                />
              );
            })}
          </g>

          <g style={{ pointerEvents: "none" }}>
            {L.edges
              .filter((e) => e.label)
              .map((e) => {
                const on = hv && (e.s === hv || e.t === hv);
                return (
                  <text
                    key={e.id}
                    ref={(el) => { this.el[e.id] = el; }}
                    textAnchor="middle"
                    fontFamily={T.mono}
                    fontSize={T.cap}
                    fill={T.ink2}
                    style={{ opacity: on ? 1 : 0, transition: "opacity .2s" }}
                    {...halo}
                  >
                    {e.label}
                  </text>
                );
              })}
          </g>

          <g>
            {L.nodes.map((n) => {
              const dim = hv && !adj[n.id], isSel = sel === n.id, lp = labelPos(n);
              return (
                <g
                  key={n.id}
                  ref={(el) => { this.g[n.id] = el; }}
                  transform={`translate(${n.x} ${n.y}) scale(0.55)`}
                  opacity={0}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label} — ${PROOF[n.proof].label}`}
                  style={{ cursor: "pointer", outline: "none" }}
                  onMouseEnter={() => this.enter(n.id)}
                  onMouseLeave={this.leave}
                  onFocus={() => this.enter(n.id)}
                  onBlur={this.leave}
                  onClick={() => onSelect(n.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onSelect(n.id);
                    }
                  }}
                >
                  <g style={{ opacity: dim ? 0.22 : 1, transition: "opacity .25s" }}>
                    <circle r={n.r + 16} fill="transparent" style={{ pointerEvents: "all" }} />
                    {isSel && (
                      <circle
                        key={"sel-" + n.id}
                        r={n.r + 8}
                        fill="none"
                        stroke={T.accent}
                        strokeWidth={1.3}
                        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kgRing .5s cubic-bezier(.2,.7,.2,1)" }}
                      />
                    )}
                    {!isSel && hv === n.id && (
                      <circle r={n.r + 6} fill="none" stroke={T.ink2} strokeWidth={1} strokeOpacity={0.7} />
                    )}
                    {n.main && <circle r={n.r + 4} fill="none" stroke={T.accent} strokeOpacity={0.35} strokeWidth={1} />}
                    <circle r={n.r} {...nodeStyle(n)} />
                    <text
                      x={lp.x}
                      y={lp.ly}
                      textAnchor={lp.a}
                      fontFamily={T.sans}
                      fontSize={n.main ? T.label + 2.5 : T.label}
                      fontWeight={n.main ? 700 : T.weight}
                      fill={T.ink}
                      {...halo}
                    >
                      {n.label}
                    </text>
                    <text x={lp.x} y={lp.cy} textAnchor={lp.a} fontFamily={T.mono} fontSize={T.cap} fill={T.ink2} letterSpacing="0.1em" {...halo}>
                      {n.type.toUpperCase()}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        <div ref={(el) => { this.tip = el; }} style={tipStyle} aria-hidden>
          {tn && te && pr && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 18, borderTop: swatch(tn.proof) }} />
                <span style={{ fontWeight: 500 }}>Preuve : {pr.label}</span>
                {pr.verify && <span style={{ color: T.warn }}>· à vérifier</span>}
              </div>
              <div style={{ color: T.ink2, marginTop: 2 }}>{te.note}</div>
              <div style={{ color: T.ink2, marginTop: 6 }}>Cliquer pour la fiche →</div>
            </>
          )}
        </div>
      </div>
    );
  }
}
