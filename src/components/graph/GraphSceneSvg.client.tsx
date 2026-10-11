"use client";

/*
 * KYB Graph — scène SVG « Registre / Nuit » (refonte du graphe dossier).
 *
 * Portage de la maquette Claude Design « Dossier Graphe — refonte » : le graphe
 * adopte la charte de l'accueil (encre, filets, accent unique) au lieu des orbes
 * lustrés sur fond indigo. Tout est en tokens (`var(--…)`) : la scène suit le
 * thème clair « Registre » comme le thème sombre « Nuit ».
 *
 *   - mise en page radiale autour de l'entité racine (lib/graph/graph-view) ;
 *   - niveau de preuve encodé par la forme : plein / filet / tirets / pointillés ;
 *   - dérive douce, attraction vers le pointeur, apparition progressive
 *     (tout est coupé sous `prefers-reduced-motion`) ;
 *   - survol → voisinage mis en avant, infobulle ; clic → fiche + cadrage ;
 *   - recherche, couches et curseur temporel lus dans le store à chaque frame ;
 *   - glisser-déposer, pan, zoom molette, mini-carte, export PNG, sons discrets.
 *
 * Le DOM SVG est piloté impérativement (une frame = des setAttribute), React ne
 * rend que l'infobulle et le cadre de la mini-carte.
 */

import { useEffect, useRef } from "react";
import { useGraphStore } from "@/lib/store/graph-store";
import type { Severity } from "@/lib/graph/graph-types";
import { EVIDENCE_LABELS, NODE_LABELS, isHypothesis } from "@/lib/graph/graph-types";
import { SEVERITY_TONE } from "@/lib/design/domain-tones";
import { TONE_CSS_VAR } from "@/lib/design/tone";
import {
  VIEW_H,
  VIEW_W,
  computeVisibility,
  dateAtFraction,
  layoutGraphView,
  searchMatches,
  structuralLinks,
  type GraphView,
  type LabelSide,
  type ViewEdge,
  type ViewNode,
  type Visibility,
} from "@/lib/graph/graph-view";
import { formatDateFr } from "@/lib/format-date";
import { EDGE_STROKE, PUBLISH_STROKE, nodePaint, proofSwatchStyle } from "./proof-style";

const NS = "http://www.w3.org/2000/svg";
/** Largeur de la fiche latérale (px écran) : le cadrage d'une sélection la contourne. */
const PANEL_PX = 340;
const MINI_W = 168;

type EngineNode = ViewNode & {
  r: number;
  side: LabelSide;
  delay: number;
  /** Position de base (mise en page ou glisser-déposer). */
  bx: number;
  by: number;
  /** Base affichée : rejoint (bx, by) en douceur après un recadrage. */
  dx: number;
  dy: number;
  /** Position vivante (base + dérive + attraction). */
  px: number;
  py: number;
  ox: number;
  oy: number;
  ph: number;
  op: number;
  lop: number;
  degree: number;
  g: SVGGElement;
  body: SVGCircleElement;
  hit: SVGCircleElement;
  selR: SVGCircleElement;
  hovR: SVGCircleElement;
  riskR: SVGCircleElement;
  mainR: SVGCircleElement | null;
  t1: SVGTextElement;
  t2: SVGTextElement;
  dot: SVGCircleElement;
};

type EngineEdge = ViewEdge & {
  el: SVGLineElement;
  hit: SVGLineElement;
  lbl: SVGTextElement | null;
  op: number;
  delay: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function mk<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

/** Halo de lecture : contour couleur du fond derrière le texte (lisible sur les liens). */
const HALO = {
  paintOrder: "stroke",
  stroke: "var(--background)",
  strokeWidth: "5px",
  strokeLinejoin: "round",
} as const;

function labelPos(r: number, side: LabelSide) {
  const o = r + 10;
  if (side === "left") return { x: -o, ly: -2, cy: 10, a: "end" };
  if (side === "top") return { x: 0, ly: -(r + 21), cy: -(r + 9), a: "middle" };
  if (side === "bottom") return { x: 0, ly: r + 20, cy: r + 32, a: "middle" };
  return { x: o, ly: -2, cy: 10, a: "start" };
}

export default function GraphSceneSvg({
  view,
  flaggedSeverity,
  exportName,
}: {
  view: GraphView;
  /** Sévérité maximale par nœud signalé → couleur de l'anneau de la couche « Risques ». */
  flaggedSeverity: Record<string, Severity>;
  /** Préfixe du fichier PNG exporté. */
  exportName: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<SVGSVGElement>(null);
  const hoveredId = useGraphStore((s) => s.hoveredId);
  const panelOpen = useGraphStore((s) => Boolean(s.selectedNode || s.selectedEdge));

  useEffect(() => {
    const svg = svgRef.current;
    const mini = miniRef.current;
    if (!svg || !mini) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    // ── construction ──
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    while (mini.firstChild) mini.removeChild(mini.firstChild);
    const world = mk("g");
    const gE = mk("g");
    const gEL = mk("g");
    const gN = mk("g");
    gEL.style.pointerEvents = "none";
    world.append(gE, gEL, gN);
    svg.appendChild(world);
    const gMini = mk("g");
    const miniRect = mk("rect", { fill: "none", "stroke-width": 12 });
    miniRect.style.stroke = "var(--primary)";
    mini.append(gMini, miniRect);

    const nodes: EngineNode[] = [];
    const by: Record<string, EngineNode> = {};
    const edges: EngineEdge[] = [];
    const adj: Record<string, Set<string>> = {};
    const inc: Record<string, EngineEdge[]> = {};

    let hover: string | null = null;
    let hoverEdge: string | null = null;
    let gestured = false;
    let down: { node?: EngineNode; edge?: string; x: number; y: number; moved: boolean; gx: number; gy: number } | null =
      null;
    let pan: { x: number; y: number; moved: boolean } | null = null;
    let cur: { x: number; y: number } | null = null;
    let audio: AudioContext | null = null;
    let lastHov = 0;
    let H = VIEW_H;
    let laidOut = false;

    for (const vn of view.nodes) {
      const isEv = vn.kind === "event";
      const g = mk("g", { class: "node", "data-id": vn.id, tabindex: isEv ? -1 : 0, role: "button" });
      g.setAttribute("aria-label", `${vn.label} : ouvrir la fiche`);
      g.setAttribute(
        "aria-description",
        `${NODE_LABELS[vn.kind]} · preuve : ${EVIDENCE_LABELS[vn.evidence].toLowerCase()}`,
      );
      g.style.cursor = "pointer";
      g.style.outline = "none";
      const hit = mk("circle", { fill: "transparent" });
      hit.style.pointerEvents = "all";
      const selR = mk("circle", { fill: "none", "stroke-width": 1.3 });
      Object.assign(selR.style, { stroke: "var(--primary)", opacity: "0", transformBox: "fill-box", transformOrigin: "center" });
      const hovR = mk("circle", { fill: "none", "stroke-width": 1, "stroke-opacity": 0.7 });
      Object.assign(hovR.style, { stroke: "var(--muted-foreground)", opacity: "0" });
      const riskR = mk("circle", { fill: "none", "stroke-width": 1.2, "stroke-dasharray": "3 3" });
      const sev = flaggedSeverity[vn.id];
      Object.assign(riskR.style, { stroke: sev ? TONE_CSS_VAR[SEVERITY_TONE[sev]] : "var(--tone-vigilance)", opacity: "0" });
      const body = mk("circle");
      g.append(hit, selR, hovR, riskR);
      let mainR: SVGCircleElement | null = null;
      if (vn.main) {
        mainR = mk("circle", { fill: "none", "stroke-opacity": 0.35, "stroke-width": 1 });
        mainR.style.stroke = "var(--primary)";
        g.appendChild(mainR);
      }
      g.appendChild(body);
      const t1 = mk("text", { class: "lbl" });
      t1.textContent = vn.short;
      Object.assign(t1.style, {
        fontSize: vn.main ? "17px" : isEv ? "12px" : "13px",
        fontWeight: vn.main ? "700" : "600",
        fill: "var(--foreground)",
        ...HALO,
      });
      const t2 = mk("text", { class: "font-mono", "letter-spacing": "0.1em" });
      t2.textContent = NODE_LABELS[vn.kind].toUpperCase();
      Object.assign(t2.style, { fontSize: "10px", fill: "var(--muted-foreground)", ...HALO });
      g.append(t1, t2);
      gN.appendChild(g);
      const dot = mk("circle");
      dot.style.fill = "var(--foreground)";
      gMini.appendChild(dot);

      const n: EngineNode = {
        ...vn,
        r: 10,
        side: "right",
        delay: 0.5,
        bx: 0,
        by: 0,
        dx: 0,
        dy: 0,
        px: 0,
        py: 0,
        ox: 0,
        oy: 0,
        ph: 0,
        op: 0,
        lop: 0,
        degree: 0,
        g,
        body,
        hit,
        selR,
        hovR,
        riskR,
        mainR,
        t1,
        t2,
        dot,
      };
      nodes.push(n);
      by[vn.id] = n;
      adj[vn.id] = new Set();
      inc[vn.id] = [];

      g.addEventListener("pointerenter", () => setHover(vn.id));
      g.addEventListener("pointerleave", () => setHover(null));
      g.addEventListener("focus", () => setHover(vn.id));
      g.addEventListener("blur", () => setHover(null));
      g.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation();
        gestured = true;
        ensureAudio();
        const w = toWorld(ev.clientX, ev.clientY);
        down = { node: n, x: ev.clientX, y: ev.clientY, moved: false, gx: w.x - n.bx, gy: w.y - n.by };
      });
      g.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          select(vn.id);
        }
      });
    }

    for (const ve of view.edges) {
      const a = by[ve.source];
      const b = by[ve.target];
      if (!a || !b) continue;
      const pub = ve.type === "A_PUBLIE";
      const st = pub ? PUBLISH_STROKE : EDGE_STROKE[ve.evidence];
      const el = mk("line", { class: "edge-line" });
      Object.assign(el.style, {
        stroke: st.stroke,
        strokeWidth: `${st.width}px`,
        strokeDasharray: st.dash ?? "",
        strokeLinecap: st.cap ?? "",
        pointerEvents: "none",
        opacity: "0",
      });
      const hit = mk("line", { class: "edge", "data-edge-id": ve.id, stroke: "transparent", "stroke-width": pub ? 6 : 12 });
      hit.style.cursor = "pointer";
      hit.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation();
        gestured = true;
        down = { edge: ve.id, x: ev.clientX, y: ev.clientY, moved: false, gx: 0, gy: 0 };
      });
      hit.addEventListener("pointerenter", () => (hoverEdge = ve.id));
      hit.addEventListener("pointerleave", () => {
        if (hoverEdge === ve.id) hoverEdge = null;
      });
      gE.append(el, hit);
      let lbl: SVGTextElement | null = null;
      const text = ve.label ?? ve.weight;
      if (text) {
        lbl = mk("text", { class: "font-mono", "text-anchor": "middle" });
        lbl.textContent = text;
        Object.assign(lbl.style, { fontSize: "10px", fill: "var(--muted-foreground)", opacity: "0", transition: "opacity .2s", ...HALO });
        gEL.appendChild(lbl);
      }
      const e: EngineEdge = { ...ve, el, hit, lbl, op: 0, delay: 0 };
      edges.push(e);
      adj[a.id].add(b.id);
      adj[b.id].add(a.id);
      inc[a.id].push(e);
      inc[b.id].push(e);
      if (!pub) {
        a.degree++;
        b.degree++;
      }
    }

    // ── mise en page (recalculée quand le format du cadre change) ──
    function applyLayout() {
      const pos = layoutGraphView(view, VIEW_W, H);
      for (const n of nodes) {
        const p = pos[n.id];
        if (!p) continue;
        n.r = p.r;
        n.side = p.side;
        n.delay = p.delay;
        n.bx = p.x;
        n.by = p.y;
        if (!laidOut) {
          n.dx = p.x;
          n.dy = p.y;
          n.px = p.x;
          n.py = p.y;
          n.ph = (p.x * 0.013 + p.y * 0.021) % 6.283;
        }
        const isEv = n.kind === "event";
        n.hit.setAttribute("r", String(n.r + (isEv ? 9 : 16)));
        n.selR.setAttribute("r", String(n.r + 8));
        n.hovR.setAttribute("r", String(n.r + 6));
        n.riskR.setAttribute("r", String(n.r + 5));
        n.mainR?.setAttribute("r", String(n.r + 4));
        n.body.setAttribute("r", String(n.r));
        const lp = labelPos(n.r, n.side);
        n.t1.setAttribute("x", String(lp.x));
        n.t1.setAttribute("y", String(lp.ly));
        n.t1.setAttribute("text-anchor", lp.a);
        n.t2.setAttribute("x", String(lp.x));
        n.t2.setAttribute("y", String(lp.cy));
        n.t2.setAttribute("text-anchor", lp.a);
        n.dot.setAttribute("cx", p.x.toFixed(0));
        n.dot.setAttribute("cy", p.y.toFixed(0));
        n.dot.setAttribute("r", String(isEv ? 6 : n.main ? 24 : 14));
      }
      for (const e of edges) e.delay = Math.max(by[e.source].delay, by[e.target].delay) + 0.05;
      svg!.setAttribute("viewBox", `0 0 ${VIEW_W} ${H}`);
      mini!.setAttribute("viewBox", `0 0 ${VIEW_W} ${H}`);
      mini!.setAttribute("height", String(Math.round((MINI_W * H) / VIEW_W)));
      laidOut = true;
    }
    function measure() {
      const r = svg!.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const h = Math.round(Math.max(560, Math.min(1100, (VIEW_W * r.height) / r.width)));
      if (!laidOut || Math.abs(h - H) / H > 0.04) {
        H = h;
        applyLayout();
        camT = { s: 1, tx: 0, ty: 0 };
      }
    }

    // ── peinture des nœuds (preuve / communauté / chemin) ──
    let paintKey = "";
    let pathNodes = new Set<string>();
    let pathEdges = new Set<string>();
    function repaint() {
      const st = useGraphStore.getState();
      const key = `${st.colorMode}|${st.path?.nodes.join(">") ?? ""}`;
      if (key === paintKey) return;
      paintKey = key;
      pathNodes = new Set(st.path && st.path.nodes.length > 1 ? st.path.nodes : []);
      pathEdges = new Set();
      if (pathNodes.size) {
        const seq = st.path!.nodes;
        for (let i = 0; i < seq.length - 1; i++) {
          for (const e of edges) {
            if ((e.source === seq[i] && e.target === seq[i + 1]) || (e.source === seq[i + 1] && e.target === seq[i]))
              pathEdges.add(e.id);
          }
        }
      }
      for (const n of nodes) {
        const p = nodePaint({ evidence: n.evidence, main: n.main, community: st.colorMode === "community", cluster: n.cluster });
        const S = n.body.style;
        S.fill = p.fill;
        S.stroke = pathNodes.has(n.id) && !n.main ? "var(--primary)" : p.stroke;
        S.strokeWidth = pathNodes.has(n.id) && !n.main ? "2.4px" : p.strokeWidth;
        S.strokeDasharray = pathNodes.has(n.id) ? "" : p.dash;
        S.strokeLinecap = p.cap;
      }
      for (const e of edges) {
        const onPath = pathEdges.has(e.id);
        const st2 = e.type === "A_PUBLIE" ? PUBLISH_STROKE : EDGE_STROKE[e.evidence];
        e.el.style.stroke = onPath ? "var(--primary)" : st2.stroke;
        e.el.style.strokeWidth = `${onPath ? 2.4 : st2.width}px`;
      }
    }

    // ── caméra (unités du repère SVG) ──
    const cam = { s: 1, tx: 0, ty: 0 };
    let camT = { s: 1, tx: 0, ty: 0 };
    function toStage(cx: number, cy: number) {
      const m = svg!.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const inv = m.inverse();
      return { x: inv.a * cx + inv.c * cy + inv.e, y: inv.b * cx + inv.d * cy + inv.f };
    }
    function toWorld(cx: number, cy: number) {
      const p = toStage(cx, cy);
      return { x: (p.x - cam.tx) / cam.s, y: (p.y - cam.ty) / cam.s };
    }
    function zoomAt(p: { x: number; y: number }, f: number) {
      const w = { x: (p.x - camT.tx) / camT.s, y: (p.y - camT.ty) / camT.s };
      camT.s = Math.max(0.5, Math.min(3, camT.s * f));
      camT.tx = p.x - w.x * camT.s;
      camT.ty = p.y - w.y * camT.s;
    }
    function focusOn(x: number, y: number) {
      const S = 1.4;
      const m = svg!.getScreenCTM();
      const panel = PANEL_PX / (m ? m.a : 1);
      camT = { s: S, tx: (VIEW_W - panel) / 2 - x * S, ty: H / 2 - y * S };
    }
    function focusSelection() {
      const st = useGraphStore.getState();
      const n = st.selectedNode ? by[st.selectedNode] : null;
      const e = st.selectedEdge ? edges.find((x) => x.id === st.selectedEdge) : null;
      if (n) focusOn(n.px, n.py);
      else if (e) focusOn((by[e.source].px + by[e.target].px) / 2, (by[e.source].py + by[e.target].py) / 2);
      else camT = { s: 1, tx: 0, ty: 0 };
    }

    // ── son / haptique (discrets, seulement après un geste de l'utilisateur) ──
    function ensureAudio() {
      if (!gestured) return;
      if (!audio) {
        try {
          const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audio = new Ctor();
        } catch {
          audio = null;
        }
      }
      if (audio && audio.state === "suspended") void audio.resume();
    }
    function blip(freq: number, vol: number, dur: number) {
      if (!useGraphStore.getState().sound || !gestured) return;
      ensureAudio();
      if (!audio) return;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0;
      o.connect(g);
      g.connect(audio.destination);
      const t = audio.currentTime;
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    function haptic(ms: number) {
      try {
        navigator.vibrate?.(ms);
      } catch {
        /* noop */
      }
    }

    // ── interactions ──
    function setHover(id: string | null) {
      if (id === hover) return;
      hover = id;
      if (id && performance.now() - lastHov > 90) {
        blip(880, 0.012, 0.07);
        lastHov = performance.now();
      }
      useGraphStore.getState().setHovered(id);
    }
    function select(id: string) {
      blip(523, 0.05, 0.16);
      haptic(10);
      useGraphStore.getState().selectNode(id);
    }
    function selectEdge(id: string) {
      blip(440, 0.04, 0.14);
      haptic(8);
      useGraphStore.getState().selectEdge(id);
    }
    const onSvgDown = (ev: PointerEvent) => {
      gestured = true;
      ensureAudio();
      pan = { x: ev.clientX, y: ev.clientY, moved: false };
      try {
        svg!.setPointerCapture?.(ev.pointerId);
      } catch {
        /* pointeur synthétique */
      }
    };
    const onMove = (ev: PointerEvent) => {
      cur = { x: ev.clientX, y: ev.clientY };
      if (down) {
        if (!down.moved && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 4) return;
        down.moved = true;
        if (down.node) {
          const w = toWorld(ev.clientX, ev.clientY);
          down.node.bx = down.node.dx = w.x - down.gx;
          down.node.by = down.node.dy = w.y - down.gy;
        }
        return;
      }
      if (!pan) return;
      const a = toStage(pan.x, pan.y);
      const b = toStage(ev.clientX, ev.clientY);
      if (Math.hypot(b.x - a.x, b.y - a.y) > 2) pan.moved = true;
      camT.tx += b.x - a.x;
      camT.ty += b.y - a.y;
      cam.tx += b.x - a.x;
      cam.ty += b.y - a.y;
      pan.x = ev.clientX;
      pan.y = ev.clientY;
    };
    const onUp = () => {
      const d = down;
      if (d) {
        down = null;
        if (d.moved) {
          if (d.node) haptic(6);
          return;
        }
        if (d.node) select(d.node.id);
        else if (d.edge) selectEdge(d.edge);
        return;
      }
      if (pan) {
        if (!pan.moved) useGraphStore.getState().clearSelection();
        pan = null;
      }
    };
    const onOut = (ev: PointerEvent) => {
      if (!ev.relatedTarget) cur = null;
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      zoomAt(toStage(ev.clientX, ev.clientY), ev.deltaY < 0 ? 1.12 : 0.89);
    };
    const onMiniClick = (ev: MouseEvent) => {
      const r = mini!.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * VIEW_W;
      const y = ((ev.clientY - r.top) / r.height) * H;
      camT.tx = VIEW_W / 2 - x * camT.s;
      camT.ty = H / 2 - y * camT.s;
    };
    const onCamera = (ev: Event) => {
      const action = (ev as CustomEvent<"in" | "out" | "fit" | "selection">).detail;
      if (action === "in") zoomAt({ x: VIEW_W / 2, y: H / 2 }, 1.25);
      else if (action === "out") zoomAt({ x: VIEW_W / 2, y: H / 2 }, 0.8);
      else if (action === "selection") focusSelection();
      else camT = { s: 1, tx: 0, ty: 0 };
    };

    // ── export PNG : styles calculés recopiés (les var(--…) ne survivent pas à la sérialisation) ──
    function exportPng() {
      try {
        const clone = svg!.cloneNode(true) as SVGSVGElement;
        const src = svg!.querySelectorAll("*");
        const dst = clone.querySelectorAll("*");
        const props = [
          "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-opacity",
          "fill-opacity", "opacity", "font-family", "font-size", "font-weight", "paint-order", "letter-spacing",
        ];
        src.forEach((el, i) => {
          const cs = getComputedStyle(el);
          const target = dst[i] as SVGElement;
          props.forEach((p) => target.style.setProperty(p, cs.getPropertyValue(p)));
        });
        clone.setAttribute("width", String(VIEW_W));
        clone.setAttribute("height", String(H));
        clone.setAttribute("xmlns", NS);
        clone.removeAttribute("style");
        clone.removeAttribute("class");
        const bg = mk("rect", { width: VIEW_W, height: H });
        bg.setAttribute("fill", getComputedStyle(svg!).getPropertyValue("--background").trim() || "white");
        clone.insertBefore(bg, clone.firstChild);
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = VIEW_W * 2;
          c.height = H * 2;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0);
          c.toBlob((blob) => {
            if (!blob) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${exportName}-${new Date().toISOString().slice(0, 10)}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
          });
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(clone))));
      } catch {
        /* export au mieux */
      }
    }

    // ── visibilité (cache) ──
    let visKey = "";
    let vis: Visibility = { nodes: new Set(), edges: new Set(), counts: { entities: 0, links: 0, events: 0 } };
    let matchQ = "";
    let matches = new Set<string>();
    function visibility() {
      const st = useGraphStore.getState();
      const at = view.timeStart ? dateAtFraction(view.timeStart, view.timeEnd, st.cursor) : null;
      const key = `${at}|${Object.values(st.layers).join("")}`;
      if (key !== visKey) {
        visKey = key;
        vis = computeVisibility(view, st.layers, at);
      }
      return vis;
    }

    // ── boucle d'animation ──
    const t0 = performance.now();
    let raf = 0;
    function seg(el: SVGLineElement, a: EngineNode, b: EngineNode, p: number) {
      const ddx = b.px - a.px;
      const ddy = b.py - a.py;
      const d = Math.hypot(ddx, ddy) || 1;
      const ux = ddx / d;
      const uy = ddy / d;
      const x1 = a.px + ux * (a.r + 4);
      const y1 = a.py + uy * (a.r + 4);
      const x2 = b.px - ux * (b.r + 4);
      const y2 = b.py - uy * (b.r + 4);
      el.setAttribute("x1", x1.toFixed(1));
      el.setAttribute("y1", y1.toFixed(1));
      el.setAttribute("x2", (x1 + (x2 - x1) * p).toFixed(1));
      el.setAttribute("y2", (y1 + (y2 - y1) * p).toFixed(1));
    }
    function tick(now: number) {
      if (!laidOut) {
        measure();
        if (!laidOut) return;
      }
      const ctm = svg!.getScreenCTM();
      if (!ctm) return;
      repaint();
      const st = useGraphStore.getState();
      const t = (now - t0) / 1000;
      const V = visibility();
      const q = st.query.trim();
      if (q !== matchQ) {
        matchQ = q;
        matches = searchMatches(view, q);
      }
      const c = !reduced && cur && !down && st.viewMode === "graph" ? toWorld(cur.x, cur.y) : null;
      const intro = (d: number) => (reduced ? 1 : 1 - Math.pow(1 - clamp01((t - d) / 0.75), 3));
      const hv = hover && by[hover] ? hover : null;
      const sel = st.selectedNode && by[st.selectedNode] ? st.selectedNode : null;
      const focus = hv || sel;
      const adjF = focus ? adj[focus] : null;
      const hasPath = pathNodes.size > 0;
      const fl = reduced ? 0 : 2.4;
      for (const n of nodes) {
        const k = n.kind === "event" ? 0.8 : 1;
        let tx = Math.sin(t * 0.55 + n.ph) * fl * k;
        let ty = Math.cos(t * 0.47 + n.ph * 1.7) * fl * k;
        if (c) {
          const vx = c.x - n.bx;
          const vy = c.y - n.by;
          const d = Math.hypot(vx, vy);
          if (d < 300 && d > 0.5) {
            const f = Math.pow(1 - d / 300, 2) * 0.35;
            let ax = vx * f;
            let ay = vy * f;
            const mm = Math.hypot(ax, ay);
            const cc = 24 * k;
            if (mm > cc) {
              ax *= cc / mm;
              ay *= cc / mm;
            }
            tx += ax;
            ty += ay;
          }
        }
        n.ox += (tx - n.ox) * 0.075;
        n.oy += (ty - n.oy) * 0.075;
        n.dx = lerp(n.dx, n.bx, 0.12);
        n.dy = lerp(n.dy, n.by, 0.12);
        n.px = n.dx + n.ox;
        n.py = n.dy + n.oy;

        let v = V.nodes.has(n.id) ? 1 : 0;
        const match = q ? matches.has(n.id) : false;
        if (v) {
          let f = 1;
          if (focus) f = n.id === focus || adjF!.has(n.id) ? 1 : hv ? 0.16 : 0.3;
          if (q) f *= match ? 1 : 0.1;
          if (hasPath) f *= pathNodes.has(n.id) ? 1 : 0.12;
          v = f * (n.kind === "event" && n.id !== focus ? 0.5 : 1);
        }
        n.op = lerp(n.op, v, 0.12);
        // Libellés : toujours pour les entités ; pour un événement, seulement en focus ou
        // trouvé ; en graphe dense, les entités secondaires ne s'étiquettent qu'en contexte.
        const contextual = n.id === focus || (adjF?.has(n.id) ?? false) || match || pathNodes.has(n.id);
        const quiet = n.kind === "event" || (view.dense && !n.main && n.degree < 2);
        const lt = quiet ? (contextual ? Math.min(1, v * 2.4) : 0) : v;
        n.lop = lerp(n.lop, lt, 0.15);
        const si = intro(n.delay);
        n.g.setAttribute("transform", `translate(${n.px.toFixed(2)} ${n.py.toFixed(2)}) scale(${(0.55 + 0.45 * si).toFixed(3)})`);
        n.g.setAttribute("opacity", (si * n.op).toFixed(3));
        n.g.style.pointerEvents = n.op > 0.05 ? "auto" : "none";
        n.t1.style.opacity = n.lop.toFixed(3);
        n.t2.style.opacity = (view.dense ? Math.min(n.lop, contextual || n.main ? 1 : 0) : n.lop).toFixed(3);
        n.selR.style.opacity = sel === n.id ? "1" : "0";
        n.selR.style.animation = sel === n.id ? "kyb-ring 0.5s var(--motion-ease-out)" : "";
        n.hovR.style.opacity = hv === n.id && sel !== n.id ? "1" : "0";
        n.riskR.style.opacity =
          st.layers.risques && flaggedSeverity[n.id] ? (reduced ? 1 : 0.55 + 0.45 * Math.sin(t * 2.2)).toFixed(2) : "0";
        n.dot.setAttribute("fill-opacity", String(n.kind === "event" ? (st.layers.evenements ? 0.3 : 0) : V.nodes.has(n.id) ? 0.85 : 0.15));
      }
      const sE = st.selectedEdge;
      for (const e of edges) {
        const a = by[e.source];
        const b = by[e.target];
        seg(e.el, a, b, intro(e.delay));
        seg(e.hit, a, b, 1);
        let v = V.edges.has(e.id) ? 1 : 0;
        if (v) {
          const adjE = e.source === focus || e.target === focus;
          let f = 1;
          if (focus) f = adjE ? 1 : hv ? 0.16 : 0.3;
          if (q) f *= matches.has(e.source) || matches.has(e.target) ? 1 : 0.1;
          if (hasPath) f *= pathEdges.has(e.id) ? 1 : 0.12;
          v = f * (e.type === "A_PUBLIE" ? (adjE ? 0.9 : 0.38) : 1);
          if (hoverEdge === e.id || sE === e.id) v = 1;
        }
        e.op = lerp(e.op, v, 0.12);
        e.el.style.opacity = e.op.toFixed(3);
        e.hit.style.pointerEvents = e.op > 0.05 ? "stroke" : "none";
        if (e.lbl) {
          e.lbl.setAttribute("x", ((a.px + b.px) / 2).toFixed(1));
          e.lbl.setAttribute("y", ((a.py + b.py) / 2 - 6).toFixed(1));
          const show = (hv && (e.source === hv || e.target === hv)) || hoverEdge === e.id || sE === e.id;
          e.lbl.style.opacity = show && e.op > 0.05 ? "1" : "0";
        }
      }
      const k = reduced ? 1 : 0.14;
      cam.s = lerp(cam.s, camT.s, k);
      cam.tx = lerp(cam.tx, camT.tx, k);
      cam.ty = lerp(cam.ty, camT.ty, k);
      world.setAttribute("transform", `translate(${cam.tx.toFixed(2)} ${cam.ty.toFixed(2)}) scale(${cam.s.toFixed(4)})`);
      miniRect.setAttribute("x", (-cam.tx / cam.s).toFixed(0));
      miniRect.setAttribute("y", (-cam.ty / cam.s).toFixed(0));
      miniRect.setAttribute("width", (VIEW_W / cam.s).toFixed(0));
      miniRect.setAttribute("height", (H / cam.s).toFixed(0));
      const tip = tipRef.current;
      const n = hv ? by[hv] : null;
      if (tip && n && svg!.parentElement) {
        const wr = svg!.parentElement.getBoundingClientRect();
        const X = cam.tx + n.px * cam.s;
        const Y = cam.ty + n.py * cam.s;
        const sx = ctm.a * X + ctm.c * Y + ctm.e - wr.left;
        const sy = ctm.b * X + ctm.d * Y + ctm.f - wr.top;
        const rr = n.r * cam.s * ctm.a + 16;
        const flip = sx > wr.width - 380;
        tip.style.transform = `translate(${(flip ? sx - rr : sx + rr).toFixed(1)}px,${sy.toFixed(1)}px) translate(${flip ? "-100%" : "0"},-50%)`;
      }
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      tick(now);
    };

    // ── branchements ──
    svg.addEventListener("pointerdown", onSvgDown);
    svg.addEventListener("wheel", onWheel, { passive: false });
    mini.addEventListener("click", onMiniClick);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerout", onOut);
    window.addEventListener("kyb:graph-camera", onCamera);
    window.addEventListener("kyb:graph-export-png", exportPng);
    const ro = new ResizeObserver(() => measure());
    ro.observe(svg);
    let prevSel = `${useGraphStore.getState().selectedNode}|${useGraphStore.getState().selectedEdge}`;
    let prevPath = useGraphStore.getState().path;
    const unsub = useGraphStore.subscribe((s) => {
      const selKey = `${s.selectedNode}|${s.selectedEdge}`;
      if (selKey !== prevSel) {
        prevSel = selKey;
        focusSelection();
      }
      if (s.path !== prevPath) {
        prevPath = s.path;
        if (s.path) camT = { s: 1, tx: 0, ty: 0 };
      }
    });
    measure();
    tick(t0);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      svg.removeEventListener("pointerdown", onSvgDown);
      svg.removeEventListener("wheel", onWheel);
      mini.removeEventListener("click", onMiniClick);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("kyb:graph-camera", onCamera);
      window.removeEventListener("kyb:graph-export-png", exportPng);
      void audio?.close();
      useGraphStore.getState().setHovered(null);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      while (mini.firstChild) mini.removeChild(mini.firstChild);
    };
  }, [view, flaggedSeverity, exportName]);

  const hv = hoveredId ? view.byId[hoveredId] : undefined;
  const linkCount = hv ? structuralLinks(view, hv.id).length : 0;
  const tipNote = hv
    ? hv.kind === "event"
      ? [hv.source, hv.date ? formatDateFr(hv.date) : null].filter(Boolean).join(" · ")
      : [hv.source, `${linkCount} lien${linkCount > 1 ? "s" : ""}`].filter(Boolean).join(" · ")
    : "";

  return (
    <>
      <svg
        ref={svgRef}
        xmlns={NS}
        preserveAspectRatio="xMidYMid meet"
        className="graph-svg absolute inset-0 block h-full w-full cursor-grab overflow-visible font-sans"
        style={{ touchAction: "none" }}
      />

      <div
        ref={tipRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-[var(--z-floating)] max-w-[360px] whitespace-nowrap rounded-sm bg-surface-3 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground shadow-lg transition-opacity duration-200"
        style={{ opacity: hv ? 1 : 0 }}
      >
        {hv ? (
          <>
            <div className="whitespace-normal font-sans text-sm font-semibold">{hv.label}</div>
            <div className="mt-1 flex items-center gap-2">
              <span style={proofSwatchStyle(hv.evidence)} />
              <span className="font-medium">Preuve : {EVIDENCE_LABELS[hv.evidence]}</span>
              {isHypothesis(hv.evidence) ? <span className="text-tone-vigilance">· à vérifier</span> : null}
            </div>
            {tipNote ? <div className="mt-0.5 text-muted-foreground">{tipNote}</div> : null}
            <div className="mt-1.5 text-muted-foreground">Cliquer pour la fiche →</div>
          </>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className="absolute bottom-[18px] right-8 z-[var(--z-raised)] hidden border border-border bg-background/85 p-1 transition-opacity duration-200 md:block"
        style={{ opacity: panelOpen ? 0 : 1, pointerEvents: panelOpen ? "none" : "auto" }}
      >
        <svg ref={miniRef} width={MINI_W} height={Math.round((MINI_W * VIEW_H) / VIEW_W)} className="block cursor-crosshair" />
      </div>
    </>
  );
}
