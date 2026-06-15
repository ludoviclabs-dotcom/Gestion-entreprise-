"use client";

/*
 * KYB Graph — moteur de rendu SVG (refonte « orbes & flux »).
 *
 * Remplace le rendu Sigma/WebGL par un rendu SVG sur-mesure qui apporte les
 * effets de la maquette de refonte :
 *   - orbes lustrés (dégradé radial + reflet spéculaire + halo lumineux),
 *   - liens fins à flux de particules orientés (sens source → cible),
 *   - respiration des nœuds à risque / sanction,
 *   - survol → voisins illuminés, le reste estompé,
 *   - clic → sélection (panneau de détail) + zoom doux sur le nœud,
 *   - glisser-déposer à ressort, pan, zoom molette,
 *   - micro-sons / retour haptique discrets (avec interrupteur).
 *
 * Le composant reste branché sur le pipeline existant : il consomme le GraphDTO
 * pré-layouté côté serveur (ForceAtlas2) et le store Zustand pour les filtres de
 * couches, le path-finding et la sélection — donc NodePanel/EdgePanel/Tooltip,
 * la toolbar et la vue table continuent de fonctionner à l'identique.
 */

import { useEffect, useRef } from "react";
import { useGraphStore } from "@/lib/store/graph-store";
import type { GraphDTO, GraphNodeDTO, LayerKey } from "@/lib/graph/graph-types";
import {
  EVIDENCE_EDGE_COLORS,
  EVIDENCE_EDGE_OPACITY,
  EVIDENCE_EDGE_SIZE,
  NODE_COLORS,
  layerForEdgeType,
  layerForNodeKind,
} from "@/lib/graph/graph-types";

const NS = "http://www.w3.org/2000/svg";
const ACCENT = "#15c2b8";
const RISK_RED = "#ef4444";
const PATH_TEAL = "#15c2b8";
const MOTION = 0.6;

// ── utilitaires couleur ──
function hexToRgb(h: string) {
  let s = h.replace("#", "");
  if (s.length === 3)
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}
function mix(hex: string, target: string, amt: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return `rgb(${Math.round(a.r + (b.r - a.r) * amt)},${Math.round(
    a.g + (b.g - a.g) * amt,
  )},${Math.round(a.b + (b.b - a.b) * amt)})`;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

type EngineNode = GraphNodeDTO & {
  ax: number; // ancre projetée (cible du ressort), depuis les coords ForceAtlas2
  ay: number;
  R: number;
  posX: number; // position live (physique)
  posY: number;
  vx: number;
  vy: number;
  _init: boolean;
  appear: number;
  dimCur: number;
  pulse: boolean;
  main: boolean;
  labelPos: "right" | "left" | "top" | "bottom";
  elG: SVGGElement;
  elHalo: SVGCircleElement;
  elRing: SVGCircleElement;
  elBody: SVGCircleElement;
  elLbl: SVGTextElement;
  _spec: SVGEllipseElement;
};
type EngineEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  evidenceLevel: GraphDTO["edges"][number]["evidenceLevel"];
  rest: number;
  dim: number;
  pcount: number;
  phase: number;
  elBase: SVGLineElement;
  elGlow: SVGLineElement;
  elHit: SVGLineElement;
  parts: { glowC: SVGCircleElement; coreC: SVGCircleElement }[];
};

export default function GraphSceneSvg({
  dto,
  flaggedIds,
}: {
  dto: GraphDTO;
  flaggedIds: string[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const flagged = new Set(flaggedIds);
    const dashed = (lvl: string) => lvl === "inferred" || lvl === "simulated";

    // ── état moteur ──
    let cssW = 0;
    let cssH = 0;
    // Groupes SVG (créés une fois, jamais réassignés — seulement appendés).
    const defs = el("defs");
    const world = el("g");
    const gEdges = el("g");
    const gParts = el("g");
    const gNodes = el("g");
    const gLabels = el("g");

    const nodes: EngineNode[] = [];
    const nodeById: Record<string, EngineNode> = {};
    const edges: EngineEdge[] = [];
    const neighborMap: Record<string, Set<string>> = {};

    const cam = { scale: 1, tx: 0, ty: 0 };
    let camT = { scale: 1, tx: 0, ty: 0 };
    let hoverId: string | null = null;
    let dragNode: EngineNode | null = null;
    let panning = false;
    let downPt = { x: 0, y: 0 };
    let moved = false;
    let t0 = performance.now();
    let rafId = 0;
    let soundOn = true;
    let audioCtx: AudioContext | null = null;
    let lastHoverSound = 0;

    // état réactif issu du store (lu à chaque frame)
    let layers = useGraphStore.getState().layers;
    let path = useGraphStore.getState().path;
    let selectedNode = useGraphStore.getState().selectedNode;
    let selectedEdge = useGraphStore.getState().selectedEdge;
    let pathNodeSet = new Set<string>();
    let pathEdgeSet = new Set<string>();

    function recomputePathSets() {
      pathNodeSet = new Set();
      pathEdgeSet = new Set();
      if (!path || path.nodes.length < 2) return;
      for (const n of path.nodes) pathNodeSet.add(n);
      for (let i = 0; i < path.nodes.length - 1; i += 1) {
        const a = path.nodes[i];
        const b = path.nodes[i + 1];
        for (const e of edges) {
          if (
            (e.source === a && e.target === b) ||
            (e.source === b && e.target === a)
          )
            pathEdgeSet.add(e.id);
        }
      }
    }

    // ── mise en page : projette les coordonnées ForceAtlas2 dans le stage ──
    function computeLayout() {
      const pad = { l: 92, r: 132, t: 48, b: 60 };
      const w = Math.max(10, cssW - pad.l - pad.r);
      const h = Math.max(10, cssH - pad.t - pad.b);
      const xs = dto.nodes.map((n) => n.x);
      const ys = dto.nodes.map((n) => n.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;
      const s = Math.min(w / spanX, h / spanY); // échelle uniforme (pas de distorsion)
      const offX = pad.l + (w - spanX * s) / 2;
      const offY = pad.t + (h - spanY * s) / 2;
      const k = clamp(Math.min(cssW, cssH) / 820, 0.8, 1.3);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      nodes.forEach((n) => {
        n.ax = offX + (n.x - minX) * s;
        n.ay = offY + (n.y - minY) * s;
        n.R = clamp(n.size * 1.25, 9, 28) * k;
        // label radiant vers l'extérieur du centroïde
        const ddx = n.x - cx;
        const ddy = n.y - cy;
        if (Math.abs(ddx) >= Math.abs(ddy)) n.labelPos = ddx >= 0 ? "right" : "left";
        else n.labelPos = ddy >= 0 ? "bottom" : "top";
        if (!n._init) {
          n.posX = n.ax;
          n.posY = n.ay;
          n._init = true;
        }
      });
      edges.forEach((e) => {
        const a = nodeById[e.source];
        const b = nodeById[e.target];
        if (a && b) e.rest = Math.hypot(a.ax - b.ax, a.ay - b.ay);
      });
    }
    function resize() {
      const r = svg!.getBoundingClientRect();
      cssW = r.width;
      cssH = r.height;
      svg!.setAttribute("viewBox", `0 0 ${cssW} ${cssH}`);
      computeLayout();
    }

    // ── defs (dégradés orbes / halos / particules) ──
    function buildDefs() {
      const kinds = Object.keys(NODE_COLORS) as (keyof typeof NODE_COLORS)[];
      let html = "";
      kinds.forEach((kd) => {
        const base = NODE_COLORS[kd];
        html += `<radialGradient id="orb-${kd}" cx="35%" cy="30%" r="72%">
          <stop offset="0%" stop-color="${mix(base, "#ffffff", 0.65)}"/>
          <stop offset="42%" stop-color="${mix(base, "#ffffff", 0.12)}"/>
          <stop offset="78%" stop-color="${base}"/>
          <stop offset="100%" stop-color="${mix(base, "#06121f", 0.55)}"/>
        </radialGradient>
        <radialGradient id="halo-${kd}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${base}" stop-opacity="0.55"/>
          <stop offset="45%" stop-color="${base}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${base}" stop-opacity="0"/>
        </radialGradient>`;
      });
      ["#cfe4ff", ACCENT, "#f5a524"].forEach((c, i) => {
        html += `<radialGradient id="pg-${i}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${mix(c, "#ffffff", 0.5)}" stop-opacity="1"/>
          <stop offset="40%" stop-color="${c}" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
        </radialGradient>`;
      });
      defs.innerHTML = html;
    }
    const particleGrad = (ev: string) =>
      ev === "confirmed" ? "url(#pg-0)" : ev === "simulated" ? "url(#pg-2)" : "url(#pg-1)";

    // ── construction des éléments ──
    function build() {
      dto.edges.forEach((src) => {
        const lvl = src.evidenceLevel;
        const color = EVIDENCE_EDGE_COLORS[lvl];
        const size = EVIDENCE_EDGE_SIZE[lvl];
        const opacity = EVIDENCE_EDGE_OPACITY[lvl];
        const g = el("g", { class: "edge", "data-edge-id": src.id });
        const hit = el("line", {
          class: "ehit",
          stroke: "transparent",
          "stroke-width": 14,
          "stroke-linecap": "round",
        });
        hit.style.pointerEvents = "stroke";
        hit.style.cursor = "pointer";
        const glow = el("line", {
          stroke: ACCENT,
          "stroke-width": size + 5,
          "stroke-linecap": "round",
          opacity: 0,
        });
        glow.style.pointerEvents = "none";
        const base = el("line", {
          stroke: color,
          "stroke-width": size,
          "stroke-linecap": "round",
          "stroke-opacity": opacity,
        });
        base.style.pointerEvents = "none";
        if (dashed(lvl)) base.setAttribute("stroke-dasharray", "2 6");
        g.appendChild(hit);
        g.appendChild(glow);
        g.appendChild(base);
        gEdges.appendChild(g);
        const rest = 120;
        const pcount = Math.max(2, Math.round(rest / 78));
        const parts: EngineEdge["parts"] = [];
        const grad = particleGrad(lvl);
        for (let i = 0; i < pcount; i++) {
          const glowC = el("circle", { r: 6, fill: grad });
          glowC.style.pointerEvents = "none";
          const coreC = el("circle", {
            r: 1.6,
            fill: lvl === "simulated" ? "#ffd9a0" : "#ffffff",
          });
          coreC.style.pointerEvents = "none";
          gParts.appendChild(glowC);
          gParts.appendChild(coreC);
          parts.push({ glowC, coreC });
        }
        edges.push({
          id: src.id,
          source: src.source,
          target: src.target,
          type: src.type,
          evidenceLevel: lvl,
          rest,
          dim: 1,
          pcount,
          phase: Math.random(),
          elBase: base,
          elGlow: glow,
          elHit: hit,
          parts,
        });
      });

      const maxSize = Math.max(...dto.nodes.map((n) => n.size));
      dto.nodes.forEach((src) => {
        const g = el("g", { class: "node", "data-id": src.id });
        const halo = el("circle", {
          r: 1,
          fill: `url(#halo-${src.kind})`,
          opacity: 0.5,
        });
        halo.style.pointerEvents = "none";
        const ring = el("circle", {
          r: 1,
          fill: "none",
          stroke: ACCENT,
          "stroke-width": 2,
          opacity: 0,
        });
        ring.style.pointerEvents = "none";
        const body = el("circle", {
          r: 1,
          fill: `url(#orb-${src.kind})`,
          stroke: mix(NODE_COLORS[src.kind], "#ffffff", 0.5),
          "stroke-opacity": 0.5,
          "stroke-width": 1,
        });
        const spec = el("ellipse", { fill: "#ffffff", opacity: 0.5 });
        spec.style.pointerEvents = "none";
        g.appendChild(halo);
        g.appendChild(ring);
        g.appendChild(body);
        g.appendChild(spec);
        gNodes.appendChild(g);
        const t = el("text", { class: "lbl" });
        t.textContent = src.label;
        gLabels.appendChild(t);

        const n: EngineNode = {
          ...src,
          ax: 0,
          ay: 0,
          R: 12,
          posX: 0,
          posY: 0,
          vx: 0,
          vy: 0,
          _init: false,
          appear: 0,
          dimCur: 1,
          pulse: flagged.has(src.id) || src.kind === "sanction",
          main: src.size >= maxSize,
          labelPos: "right",
          elG: g,
          elHalo: halo,
          elRing: ring,
          elBody: body,
          elLbl: t,
          _spec: spec,
        };
        nodes.push(n);
        nodeById[src.id] = n;
        neighborMap[src.id] = new Set();

        g.style.cursor = "pointer";
        g.addEventListener("pointerenter", () => setHover(src.id));
        g.addEventListener("pointerleave", () => setHover(null));
      });

      edges.forEach((e) => {
        neighborMap[e.source]?.add(e.target);
        neighborMap[e.target]?.add(e.source);
      });
    }

    // ── physique (ressorts + répulsion + retour à l'ancre) ──
    function physics() {
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = a.posX - b.posX;
          let dy = a.posY - b.posY;
          const d2 = dx * dx + dy * dy || 0.01;
          const minD = (a.R + b.R) * 2.1;
          if (d2 < minD * minD) {
            const d = Math.sqrt(d2);
            const f = ((minD - d) / d) * 0.5;
            dx *= f;
            dy *= f;
            if (a !== dragNode) {
              a.vx += dx;
              a.vy += dy;
            }
            if (b !== dragNode) {
              b.vx -= dx;
              b.vy -= dy;
            }
          }
        }
      edges.forEach((e) => {
        const a = nodeById[e.source];
        const b = nodeById[e.target];
        if (!a || !b) return;
        let dx = b.posX - a.posX;
        let dy = b.posY - a.posY;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (d - e.rest) * 0.012;
        dx = (dx / d) * f;
        dy = (dy / d) * f;
        if (a !== dragNode) {
          a.vx += dx;
          a.vy += dy;
        }
        if (b !== dragNode) {
          b.vx -= dx;
          b.vy -= dy;
        }
      });
      nodes.forEach((n) => {
        if (n === dragNode) return;
        n.vx += (n.ax - n.posX) * 0.02;
        n.vy += (n.ay - n.posY) * 0.02;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.posX += n.vx;
        n.posY += n.vy;
      });
    }

    // ── caméra ──
    function applyCam() {
      cam.scale = lerp(cam.scale, camT.scale, 0.14);
      cam.tx = lerp(cam.tx, camT.tx, 0.14);
      cam.ty = lerp(cam.ty, camT.ty, 0.14);
      world.setAttribute(
        "transform",
        `translate(${cam.tx} ${cam.ty}) scale(${cam.scale})`,
      );
    }
    function screenToWorld(sx: number, sy: number) {
      return { x: (sx - cam.tx) / cam.scale, y: (sy - cam.ty) / cam.scale };
    }
    function zoomAround(sx: number, sy: number, factor: number) {
      const w = screenToWorld(sx, sy);
      camT.scale = clamp(camT.scale * factor, 0.5, 2.6);
      camT.tx = sx - w.x * camT.scale;
      camT.ty = sy - w.y * camT.scale;
    }
    function fit() {
      camT = { scale: 1, tx: 0, ty: 0 };
    }
    function focusNode(n: EngineNode) {
      const S = 1.4;
      const panelOpen = window.innerWidth > 760 ? 360 : 0;
      const cx = (cssW - panelOpen) / 2;
      camT.scale = S;
      camT.tx = cx - n.ax * S;
      camT.ty = cssH / 2 - n.ay * S;
    }

    // ── focus helpers (survol / sélection) ──
    function focusId(): string | null {
      return hoverId || selectedNode;
    }
    function isActiveNode(id: string) {
      const f = focusId();
      if (!f) return true;
      return id === f || neighborMap[f]?.has(id);
    }
    function layerVisibleNode(n: EngineNode) {
      const lk = layerForNodeKind(n.kind);
      if (lk && !layers[lk as LayerKey]) return false;
      return true;
    }
    function layerVisibleEdge(e: EngineEdge) {
      const lk = layerForEdgeType(e.type);
      if (lk && !layers[lk as LayerKey]) return false;
      const a = nodeById[e.source];
      const b = nodeById[e.target];
      if (a && !layerVisibleNode(a)) return false;
      if (b && !layerVisibleNode(b)) return false;
      return true;
    }

    // ── rendu par frame ──
    function draw(time: number) {
      physics();
      nodes.forEach((n, i) => {
        const start = 140 + i * 70;
        const a = clamp((time - start) / 480, 0, 1);
        n.appear = a < 1 ? 1 - Math.pow(1 - a, 3) : 1;
      });
      const f = focusId();
      const hasPath = pathNodeSet.size > 0;

      nodes.forEach((n) => {
        let visible = layerVisibleNode(n);
        if (hasPath) visible = pathNodeSet.has(n.id); // path : priorité absolue
        const riskOn = layers.risques && flagged.has(n.id);
        const targetDim = visible ? (isActiveNode(n.id) ? 1 : 0.16) : 0;
        n.dimCur = lerp(n.dimCur, targetDim, 0.18);
        const hovered = hoverId === n.id;
        const selected = selectedNode === n.id;
        const pulseAmt = n.pulse
          ? Math.sin(time * 0.0024 + n.ax * 0.01) * 0.5 + 0.5
          : 0;
        const onPath = hasPath && pathNodeSet.has(n.id);
        const rScale = (riskOn ? 1.5 : 1) * (onPath ? 1.3 : 1);
        const sc = n.appear * (1 + (n.pulse ? 0.05 * pulseAmt : 0) + (hovered ? 0.08 : 0)) * rScale;
        n.elG.setAttribute("transform", `translate(${n.posX} ${n.posY}) scale(${sc})`);
        n.elG.setAttribute("opacity", String(clamp(n.dimCur, 0, 1)));
        n.elG.style.pointerEvents = visible ? "auto" : "none";

        // halo / orbe
        const haloBase = riskOn || onPath ? 0.5 : 0.32;
        const haloOp =
          (haloBase + (n.pulse ? 0.4 * pulseAmt : 0) + (hovered ? 0.5 : 0) + (selected ? 0.55 : 0)) *
          n.dimCur;
        n.elHalo.setAttribute("opacity", String(clamp(haloOp, 0, 1.2)));
        n.elHalo.setAttribute(
          "r",
          String(n.R * (2.2 + (n.pulse ? 0.55 * pulseAmt : 0) + (hovered || selected ? 0.5 : 0))),
        );
        n.elBody.setAttribute("r", String(n.R));
        if (riskOn || onPath) {
          n.elBody.setAttribute("fill", onPath ? PATH_TEAL : RISK_RED);
        } else {
          n.elBody.setAttribute("fill", `url(#orb-${n.kind})`);
        }
        n.elRing.setAttribute("r", String(n.R + 5));
        n.elRing.setAttribute("opacity", selected ? "1" : "0");
        n._spec.setAttribute("cx", String(-n.R * 0.3));
        n._spec.setAttribute("cy", String(-n.R * 0.36));
        n._spec.setAttribute("rx", String(n.R * 0.34));
        n._spec.setAttribute("ry", String(n.R * 0.26));

        // libellé
        const off = n.R + 9;
        let lx = n.posX;
        let ly = n.posY;
        let anchor = "start";
        let dy = "0.34em";
        if (n.labelPos === "right") {
          lx += off;
          anchor = "start";
        } else if (n.labelPos === "left") {
          lx -= off;
          anchor = "end";
        } else if (n.labelPos === "top") {
          ly -= off;
          anchor = "middle";
          dy = "0";
        } else {
          ly += off;
          anchor = "middle";
          dy = "0.9em";
        }
        const main = n.main || n.id === f || onPath || riskOn;
        const la =
          (visible ? (isActiveNode(n.id) ? 1 : 0.16) : 0) *
          clamp((n.appear - 0.6) / 0.4, 0, 1);
        const lbl = n.elLbl;
        lbl.setAttribute("x", String(lx));
        lbl.setAttribute("y", String(ly));
        lbl.setAttribute("dy", dy);
        lbl.setAttribute("text-anchor", anchor);
        lbl.setAttribute("opacity", String(la));
        lbl.setAttribute("font-size", String(main ? 14 : 12.5));
        lbl.setAttribute("font-weight", String(main ? 600 : 500));
        lbl.setAttribute("fill", main ? "#ffffff" : "#d6e2f3");
      });

      edges.forEach((e) => {
        const a = nodeById[e.source];
        const b = nodeById[e.target];
        if (!a || !b) return;
        const dx = b.posX - a.posX;
        const dy = b.posY - a.posY;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d;
        const uy = dy / d;
        const ax = a.posX + ux * (a.R + 2);
        const ay = a.posY + uy * (a.R + 2);
        const bx = b.posX - ux * (b.R + 6);
        const by = b.posY - uy * (b.R + 6);
        const appear = clamp(Math.min(a.appear, b.appear) * 1.4 - 0.4, 0, 1);
        const ex = ax + (bx - ax) * appear;
        const ey = ay + (by - ay) * appear;

        const onPath = pathEdgeSet.has(e.id);
        let visible = layerVisibleEdge(e);
        if (hasPath) visible = onPath;
        const isSel = selectedEdge === e.id;
        const active = isSel || (!!f && (e.source === f || e.target === f));
        const targetDim = !visible ? 0 : f ? (active ? 1 : 0.1) : 1;
        e.dim = lerp(e.dim, targetDim, 0.18);

        const baseColor = onPath
          ? PATH_TEAL
          : active
            ? mix(EVIDENCE_EDGE_COLORS[e.evidenceLevel], "#ffffff", 0.5)
            : EVIDENCE_EDGE_COLORS[e.evidenceLevel];
        for (const ln of [e.elBase, e.elGlow, e.elHit]) {
          ln.setAttribute("x1", String(ax));
          ln.setAttribute("y1", String(ay));
          ln.setAttribute("x2", String(ex));
          ln.setAttribute("y2", String(ey));
        }
        e.elBase.setAttribute("stroke", baseColor);
        e.elBase.setAttribute(
          "stroke-opacity",
          String(EVIDENCE_EDGE_OPACITY[e.evidenceLevel] * e.dim),
        );
        e.elBase.setAttribute(
          "stroke-width",
          String(EVIDENCE_EDGE_SIZE[e.evidenceLevel] + (onPath ? 2.2 : active ? 0.8 : 0)),
        );
        e.elGlow.setAttribute("stroke", onPath ? PATH_TEAL : ACCENT);
        e.elGlow.setAttribute("opacity", String(onPath ? 0.28 * e.dim : active ? 0.18 * e.dim : 0));
        e.elHit.style.pointerEvents = visible ? "stroke" : "none";

        // particules orientées source → cible
        const lenNow = Math.hypot(ex - ax, ey - ay);
        const show = appear > 0.98 && lenNow > 6 && e.dim > 0.02;
        const speed = (0.085 + (e.evidenceLevel === "confirmed" ? 0.04 : 0)) * (0.5 + MOTION);
        if (show) e.phase = (e.phase + speed / 60) % 1;
        e.parts.forEach((p, i) => {
          if (!show) {
            p.glowC.setAttribute("opacity", "0");
            p.coreC.setAttribute("opacity", "0");
            return;
          }
          const fr = (e.phase + i / e.pcount) % 1;
          const px = ax + (ex - ax) * fr;
          const py = ay + (ey - ay) * fr;
          const fade = Math.sin(fr * Math.PI);
          const al = (active || !f ? 0.95 : 0.1) * fade * e.dim;
          p.glowC.setAttribute("cx", String(px));
          p.glowC.setAttribute("cy", String(py));
          p.glowC.setAttribute("r", String(active || onPath ? 7 : 5.2));
          p.glowC.setAttribute("opacity", String(al * 0.8));
          p.coreC.setAttribute("cx", String(px));
          p.coreC.setAttribute("cy", String(py));
          p.coreC.setAttribute("r", String(active || onPath ? 2 : 1.5));
          p.coreC.setAttribute("opacity", String(al));
        });
      });

      applyCam();
    }
    function loop() {
      draw(performance.now() - t0);
      rafId = requestAnimationFrame(loop);
    }

    // ── son / haptique ──
    function ensureAudio() {
      if (!audioCtx) {
        try {
          const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          audioCtx = new Ctor();
        } catch {
          audioCtx = null;
        }
      }
      if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume();
    }
    function blip(freq: number, vol: number, dur: number) {
      if (!soundOn) return;
      ensureAudio();
      if (!audioCtx) return;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0;
      o.connect(g);
      g.connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    function haptic(ms: number) {
      if (navigator.vibrate) {
        try {
          navigator.vibrate(ms);
        } catch {
          /* noop */
        }
      }
    }

    // ── interactions ──
    function emitHoverToStore(id: string | null) {
      if (!id) {
        useGraphStore.getState().setHovered(null);
        return;
      }
      const n = nodeById[id];
      if (!n) return;
      useGraphStore.getState().setHovered({
        id,
        kind: "node",
        x: cam.tx + n.posX * cam.scale,
        y: cam.ty + n.posY * cam.scale,
      });
    }
    function setHover(id: string | null) {
      if (id === hoverId) return;
      hoverId = id;
      svg!.style.cursor = id ? "pointer" : "grab";
      if (id && performance.now() - lastHoverSound > 90) {
        blip(880, 0.012, 0.07);
        lastHoverSound = performance.now();
      }
      emitHoverToStore(id);
    }
    function relPt(e: PointerEvent | WheelEvent) {
      const r = svg!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onDown(e: PointerEvent) {
      const p = relPt(e);
      downPt = p;
      moved = false;
      ensureAudio();
      const target = e.target as Element;
      const nodeEl = target.closest?.(".node");
      if (nodeEl) dragNode = nodeById[nodeEl.getAttribute("data-id") || ""] || null;
      else panning = true;
      svg!.style.cursor = "grabbing";
      svg!.setPointerCapture?.(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      const p = relPt(e);
      if (dragNode) {
        const w = screenToWorld(p.x, p.y);
        dragNode.vx = w.x - dragNode.posX;
        dragNode.vy = w.y - dragNode.posY;
        dragNode.posX = w.x;
        dragNode.posY = w.y;
        moved = true;
        return;
      }
      if (panning) {
        camT.tx += p.x - downPt.x;
        camT.ty += p.y - downPt.y;
        cam.tx += p.x - downPt.x;
        cam.ty += p.y - downPt.y;
        downPt = p;
        moved = true;
      }
    }
    function onUp(e: PointerEvent) {
      if (dragNode && moved) haptic(6);
      if (!moved) {
        const target = e.target as Element;
        const nodeEl = target.closest?.(".node");
        const edgeEl = target.closest?.(".edge");
        if (nodeEl) selectNode(nodeEl.getAttribute("data-id") || "");
        else if (edgeEl) selectEdge(edgeEl.getAttribute("data-edge-id") || "");
        else useGraphStore.getState().clearSelection();
      }
      dragNode = null;
      panning = false;
      svg!.style.cursor = hoverId ? "pointer" : "grab";
    }
    function selectNode(id: string) {
      const n = nodeById[id];
      if (!n) return;
      focusNode(n);
      blip(523, 0.05, 0.16);
      haptic(10);
      useGraphStore.getState().selectNode(id);
    }
    function selectEdge(id: string) {
      blip(440, 0.04, 0.14);
      haptic(8);
      useGraphStore.getState().selectEdge(id);
    }

    // ── export PNG (sérialisation SVG → canvas) ──
    function exportPng() {
      try {
        const clone = svg!.cloneNode(true) as SVGSVGElement;
        clone.setAttribute("width", String(cssW));
        clone.setAttribute("height", String(cssH));
        const bg = document.createElementNS(NS, "rect");
        bg.setAttribute("x", "0");
        bg.setAttribute("y", "0");
        bg.setAttribute("width", String(cssW));
        bg.setAttribute("height", String(cssH));
        bg.setAttribute("fill", "#0b1020");
        clone.insertBefore(bg, clone.firstChild);
        const xml = new XMLSerializer().serializeToString(clone);
        const url =
          "data:image/svg+xml;base64," +
          btoa(unescape(encodeURIComponent(xml)));
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = cssW * 2;
          c.height = cssH * 2;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0);
          c.toBlob((blob) => {
            if (!blob) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `graphe-${new Date().toISOString().slice(0, 10)}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
          });
        };
        img.src = url;
      } catch {
        /* export best-effort */
      }
    }

    // ── évènements externes (toolbar) ──
    function onCamera(e: Event) {
      const action = (e as CustomEvent<"in" | "out" | "fit">).detail;
      const cx = cssW / 2;
      const cy = cssH / 2;
      if (action === "in") zoomAround(cx, cy, 1.25);
      else if (action === "out") zoomAround(cx, cy, 0.8);
      else fit();
    }
    function onSound(e: Event) {
      soundOn = !!(e as CustomEvent<boolean>).detail;
      if (soundOn) ensureAudio();
    }

    // ── init ──
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.classList.add("graph-svg");
    svg.appendChild(defs);
    svg.appendChild(world);
    gParts.style.pointerEvents = "none";
    gLabels.style.pointerEvents = "none";
    world.appendChild(gEdges);
    world.appendChild(gParts);
    world.appendChild(gNodes);
    world.appendChild(gLabels);

    resize();
    buildDefs();
    build();
    computeLayout();
    recomputePathSets();

    svg.style.cursor = "grab";
    svg.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = relPt(e);
      zoomAround(p.x, p.y, e.deltaY < 0 ? 1.12 : 0.89);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("kyb:graph-camera", onCamera);
    window.addEventListener("kyb:graph-export-png", exportPng);
    window.addEventListener("kyb:graph-sound", onSound);

    // abonnement au store (filtres / path / sélection)
    const unsub = useGraphStore.subscribe((s) => {
      layers = s.layers;
      selectedEdge = s.selectedEdge;
      if (s.path !== path) {
        path = s.path;
        recomputePathSets();
        if (path) fit();
      }
      // sélection : zoom doux sur le nœud ; recentrage à la désélection.
      if (s.selectedNode !== selectedNode) {
        selectedNode = s.selectedNode;
        if (selectedNode && nodeById[selectedNode]) focusNode(nodeById[selectedNode]);
        else if (!selectedNode && !path) fit();
      } else {
        selectedNode = s.selectedNode;
      }
    });

    // peinture initiale stabilisée puis boucle
    t0 = performance.now() - 100000;
    draw(100000);
    t0 = performance.now();
    loop();

    return () => {
      cancelAnimationFrame(rafId);
      unsub();
      svg.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      svg.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("kyb:graph-camera", onCamera);
      window.removeEventListener("kyb:graph-export-png", exportPng);
      window.removeEventListener("kyb:graph-sound", onSound);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    };
  }, [dto, flaggedIds]);

  return (
    <svg
      ref={svgRef}
      className="graph-svg absolute inset-0 block h-full w-full"
      style={{ touchAction: "none" }}
      xmlns={NS}
    />
  );
}
