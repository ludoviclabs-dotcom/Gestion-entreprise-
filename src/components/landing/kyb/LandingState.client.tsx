"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import KybGraph from "./KybGraph.client";
import {
  ENT,
  LAYOUT_A,
  LAYOUT_B,
  LINE_STYLE,
  MOTION,
  PROOF,
  THEME_A,
  THEME_B,
  lineColor,
  type Direction,
} from "./data";

/**
 * État partagé du landing : entité sélectionnée (commune aux deux directions)
 * et direction affichée. La direction suit le thème next-themes :
 * clair → 1a « Registre » (jour), sombre → 1b « Nuit ».
 */

interface Ctx {
  sel: string;
  select: (id: string) => void;
  /** `null` avant hydratation (thème encore inconnu côté React). */
  dir: Direction | null;
}

const LandingCtx = createContext<Ctx>({ sel: "holding", select: () => {}, dir: null });

export function LandingProvider({ children }: { children: ReactNode }) {
  const [sel, setSel] = useState("holding");
  const { resolvedTheme } = useTheme();
  const dir: Direction | null = resolvedTheme === "light" ? "a" : resolvedTheme ? "b" : null;

  useReveal(dir);

  return <LandingCtx.Provider value={{ sel, select: setSel, dir }}>{children}</LandingCtx.Provider>;
}

/* ── Apparitions au scroll ─────────────────────────────────────────────── */

function useReveal(dir: Direction | null) {
  useEffect(() => {
    if (!dir || !("IntersectionObserver" in window)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          el.style.opacity = "";
          el.style.transform = "";
          io.unobserve(el);
        }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    // Une frame plus tard : next-themes applique la classe sur <html> dans son
    // propre effet, après le nôtre — la direction cible doit être visible pour
    // que getBoundingClientRect soit juste.
    const raf = requestAnimationFrame(() => {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>(`.kgl-${dir} [data-reveal]:not([data-rv])`).forEach((el) => {
        el.setAttribute("data-rv", "1");
        if (el.getBoundingClientRect().top < vh * 0.94) return;
        const d = Number(el.dataset.delay || 0), x = el.dataset.reveal === "x";
        el.style.transition = `opacity .8s cubic-bezier(.2,.7,.2,1) ${d}ms, transform ${x ? 1.6 : 0.8}s cubic-bezier(.2,.7,.2,1) ${d}ms`;
        if (x) el.style.transform = "scaleX(0)";
        else {
          el.style.opacity = "0";
          el.style.transform = "translateY(18px)";
        }
        io.observe(el);
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      // Rien ne doit rester masqué si l'observateur disparaît avant l'apparition.
      document.querySelectorAll<HTMLElement>(`.kgl-${dir} [data-rv]`).forEach((el) => {
        if (el.style.opacity === "0" || el.style.transform) {
          el.style.opacity = "";
          el.style.transform = "";
          el.removeAttribute("data-rv");
        }
      });
    };
  }, [dir]);
}

/* ── Sélecteur Jour / Nuit ─────────────────────────────────────────────── */

export function DirectionSwitch() {
  const { setTheme } = useTheme();
  const to = (theme: "light" | "dark") => () => {
    setTheme(theme);
    window.scrollTo(0, 0);
  };
  return (
    <div className="kgl-switch" role="group" aria-label="Mode d'affichage">
      <button type="button" className="kgl-switch-a" onClick={to("light")}>
        1a · Registre
      </button>
      <button type="button" className="kgl-switch-b" onClick={to("dark")}>
        1b · Nuit
      </button>
    </div>
  );
}

/* ── Graphe + fiche entité ─────────────────────────────────────────────── */

export function HeroGraph({ variant }: { variant: Direction }) {
  const { sel, select, dir } = useContext(LandingCtx);
  return (
    <KybGraph
      layout={variant === "a" ? LAYOUT_A : LAYOUT_B}
      theme={variant === "a" ? THEME_A : THEME_B}
      selected={sel}
      onSelect={select}
      active={dir === variant}
      motion={MOTION}
    />
  );
}

function useFiche() {
  const { sel } = useContext(LandingCtx);
  const e = ENT[sel] ?? ENT.holding;
  return { e, pr: PROOF[e.proof] };
}

const FICHE_HREF = "/cases/demo-holding/graphe";

export function FicheDay() {
  const { e, pr } = useFiche();
  return (
    <div className="a-fiche" aria-live="polite">
      <div className="a-fiche-id">
        <div className="a-cap">Fiche · {e.type}</div>
        <div className="a-fiche-label">{e.label}</div>
        <div className="a-fiche-proof">
          <span style={{ width: 18, borderTop: `1.6px ${LINE_STYLE[e.proof]} ${lineColor(THEME_A)[e.proof]}` }} />
          <span>{pr.label}</span>
          {pr.verify && <span className="a-warn">· à vérifier</span>}
        </div>
      </div>
      <dl className="a-fiche-dl">
        <dt>SIREN</dt>
        <dd>{e.siren}</dd>
        <dt>Statut</dt>
        <dd>{e.statut}</dd>
        <dt>Pays</dt>
        <dd>{e.pays}</dd>
        <dt>Liens</dt>
        <dd>{e.links} lien(s)</dd>
      </dl>
      <div className="a-fiche-score">
        <div className="a-cap">Score</div>
        <div className="a-fiche-score-val">
          <span>{e.score}</span>
          <span>/100</span>
        </div>
        <div className="a-fiche-bar">
          <div style={{ width: `${e.score}%` }} />
        </div>
      </div>
      <div className="a-fiche-resume">
        <p>{e.resume}</p>
        <Link href={FICHE_HREF} className="a-fiche-link">
          <span>Voir la fiche complète</span>
          <span aria-hidden>↗</span>
        </Link>
      </div>
    </div>
  );
}

export function FicheNight() {
  const { e, pr } = useFiche();
  return (
    <div className="b-fiche" aria-live="polite">
      <div style={{ minWidth: 0 }}>
        <div className="b-cap">Fiche · {e.type}</div>
        <div className="b-fiche-label">{e.label}</div>
        <div className="b-fiche-proof">
          <span style={{ width: 18, borderTop: `1.6px ${LINE_STYLE[e.proof]} ${lineColor(THEME_B)[e.proof]}` }} />
          <span>{pr.label}</span>
          {pr.verify && <span className="b-warn">· à vérifier</span>}
          <span className="b-muted">
            · {e.statut} · {e.pays}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="b-cap">Score</div>
        <div className="b-fiche-score">
          <span>{e.score}</span>
          <span>/100</span>
        </div>
      </div>
      <p className="b-fiche-resume">{e.resume}</p>
      <div className="b-fiche-meta">
        <span>SIREN {e.siren}</span>
        <span>{e.links} lien(s)</span>
        <Link href={FICHE_HREF}>Voir la fiche complète ↗</Link>
      </div>
    </div>
  );
}
