"use client";

/*
 * Popover de détail « effet profondeur » du mockup landing.
 *
 * Au clic sur une sphère du mini-graphe (MockupGraph), ce panneau JAILLIT depuis
 * la sphère : son `transform-origin` est calé sur la position pixel exacte du
 * nœud, et il s'ouvre en `scale(0.3) → 1` + perspective/translateZ (effet 3D de
 * profondeur), par-dessus un léger assombrissement du graphe. Le nœud lui-même
 * pulse déjà (anneau vert, géré par MockupGraph).
 *
 * Données : 100 % issues des fixtures du mockup (ENTITY_SUMMARIES + graph-data) —
 * aucun champ inventé. L'en-tête s'adapte au type de nœud (avatar à initiales
 * pour les personnes, icône typée pour le reste).
 *
 * Fermeture : bouton ×, touche Échap, clic en dehors (sur le voile). Animation de
 * sortie inverse (200 ms). `prefers-reduced-motion` : simple fondu, sans 3D.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  FileCheck2,
  Globe,
  type LucideIcon,
  MapPin,
  User,
  X,
} from "lucide-react";
import { useReducedMotion } from "../useReducedMotion";
import ScoreRing from "../ScoreRing.client";
import { ENTITY_SUMMARIES } from "./mock-data";
import {
  findNode,
  type MockNodeStatus,
  type MockNodeType,
  NODE_FILL,
  NODE_TYPE_LABEL,
} from "./graph-data";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const TYPE_ICON: Record<MockNodeType, LucideIcon> = {
  company: Building2,
  person: User,
  source: FileCheck2,
  address: MapPin,
  risk: AlertTriangle,
  foreign: Globe,
};

const STATUS_COLOR: Record<MockNodeStatus, string> = {
  verified: "var(--kyb-green)",
  warning: "var(--kyb-amber)",
  risk: "var(--kyb-orange)",
  neutral: "var(--kyb-text-low)",
};

/** Initiales (première lettre du 1er et du dernier mot) — pour l'avatar personne. */
function initials(label: string): string {
  const parts = label
    .replace(/[«»"'.,]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? "");
  return (first + last).toUpperCase();
}

const ENTER_MS = 280;
const EXIT_MS = 200;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const PANEL_W = 248;

export default function NodeDetailPopover({
  openId,
  metrics,
  onClose,
}: {
  openId: string | null;
  metrics: { w: number; h: number };
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  // `renderId` survit à la fermeture le temps de jouer l'animation de sortie.
  const [renderId, setRenderId] = useState<string | null>(openId);
  const [visible, setVisible] = useState(false);
  const [boxH, setBoxH] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Ouverture / fermeture + re-pop au changement de cible. Tous les setState
  // sont différés (rAF / timeout) : on monte le panneau à scale(0.3) puis on
  // bascule `visible` à la frame suivante pour déclencher l'animation d'entrée.
  useEffect(() => {
    if (openId) {
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        setRenderId(openId);
        setVisible(false);
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    const raf = requestAnimationFrame(() => setVisible(false));
    const t = window.setTimeout(() => setRenderId(null), reduce ? 0 : EXIT_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [openId, reduce]);

  // Mesure de la hauteur réelle du panneau pour le clamp vertical + l'origine.
  useLayoutEffect(() => {
    if (panelRef.current) setBoxH(panelRef.current.offsetHeight);
  }, [renderId, metrics.w, metrics.h]);

  // Échap = fermeture ; focus initial sur le bouton de fermeture.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [openId, onClose]);

  if (!renderId || metrics.w <= 0 || metrics.h <= 0) return null;
  const node = findNode(renderId);
  const ent = ENTITY_SUMMARIES[renderId];
  if (!node || !ent) return null;

  // viewBox 640×420 rendu en `xMidYMid meet` → position pixel du nœud.
  const scale = Math.min(metrics.w / 640, metrics.h / 420);
  const offX = (metrics.w - 640 * scale) / 2;
  const offY = (metrics.h - 420 * scale) / 2;
  const px = offX + node.x * scale;
  const py = offY + node.y * scale;
  const rPx = node.radius * scale;

  // Largeur adaptative + placement (à droite du nœud, sinon à gauche), clampé.
  const pw = Math.min(PANEL_W, Math.max(176, metrics.w - 24));
  const gap = 12;
  let left = px + rPx + gap;
  if (left + pw > metrics.w - 8) left = px - rPx - gap - pw;
  left = clamp(left, 8, Math.max(8, metrics.w - pw - 8));
  const h = boxH || 248;
  const top = clamp(py - h / 2, 8, Math.max(8, metrics.h - h - 8));

  // Origine de la transform = position du nœud RELATIVE au panneau → l'effet de
  // profondeur « émane » de la sphère.
  const ox = clamp(px - left, 0, pw);
  const oy = clamp(py - top, 0, h);

  const fill = NODE_FILL[node.type];
  const Icon = TYPE_ICON[node.type];
  const statusColor = STATUS_COLOR[node.status ?? "neutral"];
  const isPerson = node.type === "person";

  const facts: { k: string; v: string }[] = [];
  if (ent.siren && ent.siren !== "—") facts.push({ k: "SIREN", v: ent.siren });
  facts.push({ k: "Statut", v: ent.statut });
  facts.push({ k: "Pays", v: ent.pays });
  facts.push({ k: "Liens", v: `${ent.links} lien(s)` });

  return (
    <>
      {/* Voile : assombrit le graphe + ferme au clic en dehors. */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 z-[4]"
        style={{
          background: "rgba(5, 8, 18, 0.42)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          opacity: visible ? 1 : 0,
          transition: `opacity ${visible ? ENTER_MS : EXIT_MS}ms ease-out`,
        }}
      />

      {/* Halo d'ancrage : renforce le départ « depuis la sphère ». */}
      <div
        aria-hidden
        className="absolute z-[5]"
        style={{
          left: px,
          top: py,
          width: 0,
          height: 0,
          opacity: visible ? 1 : 0,
          transition: `opacity ${visible ? ENTER_MS : EXIT_MS}ms ease-out`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -rPx - 8,
            top: -rPx - 8,
            width: (rPx + 8) * 2,
            height: (rPx + 8) * 2,
            borderRadius: "9999px",
            background: `radial-gradient(circle, ${fill} 0%, transparent 70%)`,
            opacity: 0.5,
          }}
        />
      </div>

      {/* Panneau de détail (jaillit de la sphère). */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche : ${ent.label}`}
        className="absolute z-[6] overflow-hidden rounded-xl border text-left"
        style={{
          left,
          top,
          width: pw,
          maxHeight: Math.max(160, metrics.h - 16),
          borderColor: "var(--kyb-line)",
          background: "linear-gradient(160deg, var(--kyb-bg1), var(--kyb-bg2))",
          boxShadow:
            "0 24px 60px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)",
          transformOrigin: `${ox}px ${oy}px`,
          transform: reduce
            ? "none"
            : visible
              ? "perspective(1200px) translateZ(0) scale(1)"
              : "perspective(1200px) translateZ(-60px) scale(0.3)",
          opacity: visible ? 1 : 0,
          transition: reduce
            ? `opacity ${visible ? ENTER_MS : EXIT_MS}ms ease-out`
            : `opacity ${visible ? ENTER_MS : EXIT_MS}ms ${EASE}, transform ${
                visible ? ENTER_MS : EXIT_MS
              }ms ${EASE}`,
        }}
      >
        {/* En-tête : avatar/icône typée + libellé + score animé + fermeture. */}
        <div className="flex items-start gap-2.5 border-b border-[var(--kyb-line)] px-3 py-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
            style={{
              background: `color-mix(in srgb, ${fill} 22%, transparent)`,
              border: `1px solid color-mix(in srgb, ${fill} 55%, transparent)`,
              color: fill,
            }}
          >
            {isPerson ? initials(ent.label) : <Icon size={16} />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold leading-tight text-[var(--kyb-text-hi)]">
              {ent.label}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9.5px] font-medium"
                style={{
                  background: `color-mix(in srgb, ${fill} 16%, transparent)`,
                  color: fill,
                }}
              >
                {NODE_TYPE_LABEL[node.type]}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--kyb-line)] px-1.5 py-px text-[9.5px] text-[var(--kyb-text-mid)]">
                <span
                  className="h-[5px] w-[5px] rounded-full"
                  style={{ backgroundColor: statusColor }}
                />
                {ent.statut}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <ScoreRing score={ent.score} size={44} />
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-[var(--kyb-text-low)] transition-colors hover:bg-white/[0.06] hover:text-[var(--kyb-text-hi)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Corps : faits clés + résumé. */}
        <div className="px-3 py-2.5">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {facts.map((f) => (
              <div key={f.k} className="min-w-0">
                <dt className="text-[9px] uppercase tracking-wide text-[var(--kyb-text-low)]">
                  {f.k}
                </dt>
                <dd className="truncate text-[11px] text-[var(--kyb-text-hi)]">
                  {f.v}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-2.5 text-[10.5px] leading-snug text-[var(--kyb-text-mid)]">
            {ent.resume}
          </p>

          <Link
            href="/cases/demo-holding/graphe"
            className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--kyb-violet-soft)] transition-colors hover:text-[var(--kyb-text-hi)]"
          >
            Voir la fiche complète
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </>
  );
}
