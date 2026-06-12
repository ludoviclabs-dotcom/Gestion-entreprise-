"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Network,
  RotateCcw,
  Search,
  SkipForward,
} from "lucide-react";
import { NODE_COLORS, NODE_LABELS } from "@/lib/graph/graph-types";
import { useReducedMotion } from "@/components/landing/useReducedMotion";
import DemoAlertCard, { type AlertVisibility } from "./DemoAlertCard.client";
import DemoGraph from "./DemoGraph.client";
import DemoKpiCounter from "./DemoKpiCounter.client";
import {
  DEMO_ALERTS,
  DEMO_CASE_TITLE,
  DEMO_EDGE_COUNT,
  DEMO_ENTITY_COUNT,
  DEMO_NODES,
  DEMO_SCORES,
  DEMO_SIREN,
  DEMO_SOURCES_LINE,
  TIMING,
  findDemoNode,
} from "./demo-data";
import { useIsMobile } from "./useIsMobile";
import "./demo-simulation.css";

/**
 * Démo guidée auto-jouée (brief v3) : recherche SIREN → chargement → graphe →
 * alertes réglementaires → scores → CTA. Sept phases :
 *   1 ouverture · 2 frappe · 3 chargement · 4 nœuds · 5 alertes · 6 scores · 7 CTA
 * Toute la chronologie vit dans un seul effet ([runId, reduce]) : « Rejouer »
 * incrémente runId (le cleanup annule les timeouts, le re-run repart de zéro),
 * « Passer » annule les timeouts et saute à l'état final. Sous
 * prefers-reduced-motion, on affiche directement l'état final (brief).
 */

type SimState = {
  phase: number;
  typedCount: number;
  searchClicked: boolean;
  visibleNodes: number;
  alerts: AlertVisibility[];
  ringNodes: Record<string, string>;
  suspectActive: boolean;
  kpiRunning: boolean;
  kpiInstant: boolean;
};

const INITIAL_SIM: SimState = {
  phase: 1,
  typedCount: 0,
  searchClicked: false,
  visibleNodes: 0,
  alerts: DEMO_ALERTS.map(() => "hidden"),
  ringNodes: {},
  suspectActive: false,
  kpiRunning: false,
  kpiInstant: false,
};

const FINAL_SIM: SimState = {
  phase: 7,
  typedCount: DEMO_SIREN.length,
  searchClicked: true,
  visibleNodes: DEMO_NODES.length,
  alerts: DEMO_ALERTS.map(() => "hidden"),
  ringNodes: {},
  suspectActive: true,
  kpiRunning: true,
  kpiInstant: true,
};

function formatSiren(digits: string): string {
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ");
}

function replaceAlert(
  alerts: AlertVisibility[],
  index: number,
  value: AlertVisibility,
): AlertVisibility[] {
  const next = [...alerts];
  next[index] = value;
  return next;
}

export default function DemoSimulation() {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const [sim, setSim] = useState<SimState>(INITIAL_SIM);
  const [runId, setRunId] = useState(0);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    // Sous reduced-motion l'état final est dérivé au rendu (`view`) — rien à
    // planifier, et aucun setState synchrone dans l'effect.
    if (reduce) return;

    const timeouts: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timeouts.push(window.setTimeout(fn, ms));
    };
    const patch = (p: Partial<SimState>) => setSim((s) => ({ ...s, ...p }));

    // Repart d'un état propre (rejouer, ou retour de reduced-motion).
    at(0, () => setSim(INITIAL_SIM));

    // ── Phase 2 : frappe du SIREN, délais aléatoires 80–180 ms ──
    const gaps = Array.from(
      { length: DEMO_SIREN.length - 1 },
      () => TIMING.keyGapMin + Math.random() * (TIMING.keyGapMax - TIMING.keyGapMin),
    );
    // Critère de validation du brief : intervalles vérifiables en console.
    console.debug(
      "[démo] intervalles de frappe (ms)",
      gaps.map((g) => Math.round(g)),
    );

    let cursor = TIMING.uiFadeIn;
    at(cursor, () => patch({ phase: 2, typedCount: 1 }));
    gaps.forEach((gap, i) => {
      cursor += gap;
      const count = i + 2;
      at(cursor, () => patch({ typedCount: count }));
    });

    // ── Phase 3 : clic simulé puis squelette de chargement ──
    cursor += TIMING.searchPause;
    at(cursor, () => patch({ searchClicked: true }));
    cursor += TIMING.searchClick;
    at(cursor, () => patch({ phase: 3 }));

    // ── Phase 4 : apparition des nœuds (T = ancre du reste du récit) ──
    const t4 = cursor + TIMING.loading;
    at(t4, () => patch({ phase: 4 }));
    DEMO_NODES.forEach((_, i) => {
      at(t4 + i * TIMING.nodeStep, () => patch({ visibleNodes: i + 1 }));
    });

    // ── Phase 5 : alertes réglementaires ──
    DEMO_ALERTS.forEach((alert, index) => {
      at(t4 + alert.offsetMs, () =>
        setSim((s) => ({
          ...s,
          phase: 5,
          alerts: replaceAlert(s.alerts, index, "visible"),
          ringNodes:
            alert.anchorNodeId && alert.ringColor
              ? { ...s.ringNodes, [alert.anchorNodeId]: alert.ringColor }
              : s.ringNodes,
          suspectActive: s.suspectActive || Boolean(alert.activatesSuspectEdge),
        })),
      );
      // Sans holdMs, la carte reste visible jusqu'au CTA (alerte globale).
      const holdMs = alert.holdMs ?? TIMING.phaseCta - alert.offsetMs;
      at(t4 + alert.offsetMs + holdMs, () =>
        setSim((s) => ({ ...s, alerts: replaceAlert(s.alerts, index, "leaving") })),
      );
      at(t4 + alert.offsetMs + holdMs + TIMING.cardFadeOut, () =>
        setSim((s) => ({ ...s, alerts: replaceAlert(s.alerts, index, "hidden") })),
      );
    });

    // ── Phases 6 & 7 : scores puis CTA ──
    at(t4 + TIMING.phaseScores, () => patch({ phase: 6, kpiRunning: true }));
    at(t4 + TIMING.phaseCta, () => patch({ phase: 7 }));

    timeoutsRef.current = timeouts;
    return () => {
      // Démontage / rejouer / bascule reduced-motion : plus aucun timer actif.
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [reduce, runId]);

  const skip = () => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    setSim(FINAL_SIM);
  };

  const replay = () => {
    setSim(INITIAL_SIM);
    setRunId((n) => n + 1);
  };

  // Reduced-motion : état final statique, dérivé au rendu (brief).
  const view = reduce ? FINAL_SIM : sim;
  const typed = formatSiren(DEMO_SIREN.slice(0, view.typedCount));
  const running = view.phase < 7;

  return (
    <main
      key={runId}
      className="landing-scope demo-fade-in relative flex h-dvh min-h-[540px] flex-col overflow-hidden bg-[var(--kyb-bg0)] text-[var(--kyb-text-hi)]"
    >
      {/* ── Barre supérieure : marque, recherche simulée, Passer ── */}
      <header className="relative z-50 flex items-center justify-between gap-3 border-b border-white/8 bg-[#070f20]/95 px-4 py-3 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-base font-bold sm:text-lg"
        >
          <span
            className="inline-flex h-7 w-7 items-center justify-center text-violet"
            aria-hidden
          >
            <Network size={24} strokeWidth={2.3} />
          </span>
          <span className="hidden sm:inline">KYB Graph</span>
        </Link>

        <div
          className="pointer-events-none relative flex h-10 max-w-xl flex-1 items-center gap-2 rounded-md border border-[var(--kyb-line)] bg-[#0a1227]/70 px-3"
          aria-hidden
        >
          <Search size={15} className="shrink-0 text-[var(--kyb-text-low)]" />
          <span className="flex-1 truncate text-sm tabular-nums tracking-[0.18em]">
            {view.typedCount > 0 ? (
              typed
            ) : (
              <span className="tracking-normal text-[var(--kyb-text-low)]">
                Rechercher un SIREN, une entité…
              </span>
            )}
            {view.phase <= 2 && <span className="demo-caret" />}
          </span>
          {view.typedCount > 0 && view.phase <= 3 && (
            <span
              key={view.typedCount}
              className="demo-input-flash pointer-events-none absolute inset-0 rounded-md border"
            />
          )}
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded bg-violet px-2.5 py-1.5 text-white ${
              view.searchClicked ? "demo-click-pulse" : ""
            }`}
          >
            <Search size={14} />
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-[var(--kyb-line)] px-3 py-1 text-xs text-[var(--kyb-violet-soft)] md:inline-flex">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--kyb-green)" }}
              aria-hidden
            />
            Démonstration
          </span>
          {running && (
            <button
              type="button"
              onClick={skip}
              aria-label="Passer la démonstration"
              className="inline-flex items-center gap-2 rounded-md border border-white/14 bg-[#0a1227]/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/6"
            >
              Passer <SkipForward size={15} aria-hidden />
            </button>
          )}
        </div>
      </header>

      {/* ── En-tête du dossier (apparaît avec le graphe) ── */}
      {view.phase >= 4 && (
        <div className="demo-fade-in flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-white/8 px-4 py-3 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-[family-name:var(--font-display)] text-base font-semibold sm:text-lg">
                {DEMO_CASE_TITLE}
              </h1>
              <span className="rounded-full border border-[var(--kyb-violet)]/45 bg-[var(--kyb-violet)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--kyb-violet-soft)]">
                Demo
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--kyb-text-mid)]">
              SIREN {formatSiren(DEMO_SIREN)} · {DEMO_ENTITY_COUNT} entités ·{" "}
              {DEMO_EDGE_COUNT} liens
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view.kpiRunning ? (
              <>
                <DemoKpiCounter
                  label="Complexité"
                  target={DEMO_SCORES.complexite ?? 0}
                  duration={TIMING.kpiDuration}
                  tone="risk"
                  instant={view.kpiInstant}
                />
                <DemoKpiCounter
                  label="Vigilance"
                  target={DEMO_SCORES.vigilance ?? 0}
                  duration={TIMING.kpiDuration}
                  tone="risk"
                  warningThreshold={67}
                  instant={view.kpiInstant}
                />
                <DemoKpiCounter
                  label="Qualité de preuve"
                  target={DEMO_SCORES.qualitePreuve ?? 0}
                  duration={TIMING.kpiDuration}
                  tone="good"
                  instant={view.kpiInstant}
                />
              </>
            ) : (
              ["Complexité", "Vigilance", "Qualité de preuve"].map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a1227]/70 px-3 py-1.5"
                >
                  <span className="text-xs text-[var(--kyb-text-mid)]">{label}</span>
                  <span className="text-sm font-semibold text-[var(--kyb-text-low)]">
                    —
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Zone graphe ── */}
      <div
        className={`relative flex-1 overflow-hidden bg-grid ${
          running ? "pointer-events-none" : ""
        }`}
      >
        {view.phase === 3 && (
          <div className="absolute inset-0" aria-hidden>
            {DEMO_NODES.map((node) => (
              <div
                key={node.id}
                className="demo-skeleton absolute rounded-full"
                style={{
                  left: `${node.fx * 100}%`,
                  top: `${node.fy * 100}%`,
                  width: node.r * 2,
                  height: node.r * 2,
                  marginLeft: -node.r,
                  marginTop: -node.r,
                }}
              />
            ))}
            <p className="absolute inset-x-4 bottom-6 text-center text-xs text-[var(--kyb-text-mid)] sm:text-sm">
              {DEMO_SOURCES_LINE}
            </p>
          </div>
        )}

        {view.phase >= 4 && (
          <DemoGraph
            visibleCount={view.visibleNodes}
            ringNodes={view.ringNodes}
            suspectActive={view.suspectActive}
          />
        )}

        {/* Cartes d'alerte ancrées aux nœuds (desktop uniquement) */}
        {!isMobile &&
          DEMO_ALERTS.map((alert, index) => {
            if (!alert.anchorNodeId) return null;
            const node = findDemoNode(alert.anchorNodeId);
            return (
              <div
                key={alert.id}
                className="absolute z-30"
                style={{ left: `${node.fx * 100}%`, top: `${node.fy * 100}%` }}
              >
                <div
                  className={
                    alert.anchorSide === "left"
                      ? "-ml-7 -translate-x-full -translate-y-1/2"
                      : "ml-7 -translate-y-1/2"
                  }
                >
                  <DemoAlertCard
                    alert={alert}
                    visibility={view.alerts[index]}
                    position="tooltip"
                  />
                </div>
              </div>
            );
          })}

        {/* Légende compacte (comme le vrai graphe) */}
        {view.phase >= 4 && (
          <div className="demo-fade-in absolute bottom-4 left-4 hidden rounded-md border border-white/10 bg-[#0a1227]/85 p-3 backdrop-blur md:block">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--kyb-text-low)]">
              LÉGENDE
            </p>
            {(Object.keys(NODE_LABELS) as Array<keyof typeof NODE_LABELS>).map(
              (kind) => (
                <div key={kind} className="mt-1.5 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: NODE_COLORS[kind] }}
                    aria-hidden
                  />
                  <span className="text-[11px] text-[var(--kyb-text-mid)]">
                    {NODE_LABELS[kind]}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* ── Alertes en barre du bas : alerte globale + toutes sur mobile ── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-10 z-40 flex flex-col items-center gap-2 px-4">
        {DEMO_ALERTS.map((alert, index) => {
          if (alert.anchorNodeId && !isMobile) return null;
          return (
            <DemoAlertCard
              key={alert.id}
              alert={alert}
              visibility={view.alerts[index]}
              position="bottom-bar"
            />
          );
        })}
      </div>

      {/* ── Garde-fou : démo ≠ preuve ── */}
      <footer className="relative z-10 border-t border-white/8 px-4 py-2 text-center text-[11px] leading-4 text-[var(--kyb-text-low)]">
        Démonstration automatisée — données fictives (SIREN{" "}
        {formatSiren(DEMO_SIREN)}). Références réglementaires indicatives, à
        valider par votre conformité.
      </footer>

      {/* ── Phase 7 : CTA final ── */}
      {view.phase === 7 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0b14]/55 px-4 backdrop-blur-[2px]">
          <div className="demo-cta-enter w-full max-w-md rounded-lg border border-white/12 bg-[#0e1020]/95 p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              Analyse complète disponible
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--kyb-text-mid)]">
              Graphe interactif, timeline, risques et sources — chaque lien
              porte son niveau de preuve.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/cases/demo-holding/graphe"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-violet px-5 py-3 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(124,58,237,0.35)] transition hover:bg-violet/90"
              >
                Explorer le dossier <ArrowRight size={16} aria-hidden />
              </Link>
              <button
                type="button"
                onClick={replay}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/14 bg-[#0a1227]/70 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/6"
              >
                <RotateCcw size={15} aria-hidden /> Rejouer la démo
              </button>
            </div>
            <p className="mt-4 text-[11px] leading-4 text-[var(--kyb-text-low)]">
              Données fictives. Références (art. L.561-5 et L.561-10 CMF, AMLR
              2024/1624) à faire valider par votre conformité.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
