"use client";

/* Page Secteurs — expérience interactive (composition).
   Hero + constellation · heatmap secteur × dimension · explorateur filtrable ·
   cartes secteur déployables (radar + chaîne de contrôle + 4 axes). */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CONNECTORS,
  DIMENSIONS,
  FAMILIES,
  PALETTE,
  SECTORS,
  scoreColor,
  scoreLabel,
  type DimensionKey,
  type SectorView,
} from "@/lib/domain/sector-scoring";
import { CountUp, ControlChain, Heatmap, RadarChart, RiskLegend } from "./charts";
import { NetworkConstellation } from "./NetworkConstellation";
import { SectorIcon } from "./SectorIcon";

const ACCENT = PALETTE.accent;
const ACCENT_SOFT = PALETTE.accentSoft;
const ACCENT_TEXT = "#aef0e8";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const DISPLAY = "var(--font-display)";

function LiveDot({ live }: { live: boolean }) {
  const c = live ? "#4ade9b" : "#f5b544";
  return (
    <span
      className={live ? "kyb-pulse" : ""}
      style={{ width: 7, height: 7, borderRadius: 99, background: c, color: c, display: "inline-block" }}
    />
  );
}

function SourceStrip() {
  return (
    <div style={{ border: `1px solid ${PALETTE.line}`, borderRadius: 14, background: "rgba(17,20,42,0.5)", padding: "16px 18px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "4px 16px" }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: PALETTE.textHi, margin: 0 }}>Mode live — sources officielles connectées</p>
        <p style={{ fontSize: 12, color: PALETTE.textLow, margin: 0 }}>Les connecteurs interrogent les API officielles en temps réel.</p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {CONNECTORS.map((c) => (
          <div
            key={c.key}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 9, border: `1px solid ${PALETTE.line}`, background: "rgba(10,11,20,0.6)", padding: "7px 11px" }}
          >
            <span style={{ fontSize: 12.5, color: "#cdd2e6" }}>{c.label}</span>
            <LiveDot live={c.live} />
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: c.live ? "#4ade9b" : "#f5b544", fontFamily: MONO, textTransform: "uppercase" }}>
              {c.live ? "Live" : "Démo"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AxisList({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${PALETTE.line}`, background: "rgba(10,11,20,0.45)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: tone }} />
        <h4 style={{ margin: 0, fontSize: 11.5, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", color: tone, fontFamily: DISPLAY, lineHeight: 1.2 }}>
          {title}
        </h4>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => (
          <li key={it} style={{ position: "relative", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.5, color: PALETTE.textMid }}>
            <span style={{ position: "absolute", left: 0, top: 8, width: 5, height: 5, borderRadius: 99, background: tone, opacity: 0.7 }} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectorCard({
  s,
  open,
  onToggle,
  active,
  setActive,
}: {
  s: SectorView;
  open: boolean;
  onToggle: () => void;
  active: string | null;
  setActive: (slug: string | null) => void;
}) {
  const c = scoreColor(s.intensity);
  const isHi = active === s.slug;
  return (
    <div
      onMouseEnter={() => setActive(s.slug)}
      onMouseLeave={() => setActive(null)}
      style={{
        gridColumn: open ? "1 / -1" : "auto",
        borderRadius: 16,
        border: `1px solid ${open || isHi ? c + "66" : PALETTE.line}`,
        background: open ? "rgba(17,20,42,0.6)" : "rgba(14,16,32,0.55)",
        overflow: "hidden",
        transition: "border-color .25s, background .25s",
        boxShadow: open ? "0 24px 70px rgba(0,0,0,0.45)" : isHi ? `0 12px 36px ${c}1f` : "none",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          border: "none",
          background: "transparent",
          padding: open ? "22px 24px 6px" : "20px 20px",
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
          color: "inherit",
        }}
        aria-expanded={open}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: PALETTE.textLow }}>{s.n}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: ACCENT_TEXT, border: `1px solid ${ACCENT}55`, borderRadius: 99, padding: "3px 10px", letterSpacing: ".03em", whiteSpace: "nowrap" }}>
              {s.family}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: open ? 24 : 18.5, fontWeight: 600, color: PALETTE.textHi, fontFamily: DISPLAY, lineHeight: 1.2, letterSpacing: "-0.01em", transition: "font-size .2s" }}>
            {s.sector}
          </h3>
          {open && <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: PALETTE.textMid, maxWidth: 620 }}>{s.exposure}</p>}
        </div>
        <div
          style={{
            alignSelf: "center",
            flexShrink: 0,
            width: 54,
            height: 54,
            borderRadius: 15,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: ACCENT_TEXT,
            background: `${ACCENT}1a`,
            border: `1px solid ${ACCENT}44`,
            boxShadow: `inset 0 1px 12px ${ACCENT}20`,
          }}
        >
          <SectorIcon slug={s.slug} size={28} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: c, lineHeight: 1 }}>{s.intensity}</span>
            <span style={{ fontSize: 12, color: PALETTE.textLow }}>/100</span>
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: c, fontFamily: MONO }}>{scoreLabel(s.intensity)}</span>
          <span style={{ fontSize: 18, color: PALETTE.textLow, transform: open ? "rotate(180deg)" : "none", transition: "transform .25s", lineHeight: 1 }}>⌄</span>
        </div>
      </button>

      {!open && (
        <div style={{ padding: "0 20px 18px", display: "flex", gap: 6 }}>
          {DIMENSIONS.map((d) => {
            const v = s.scores[d.key];
            return (
              <div key={d.key} title={`${d.label} · ${v}`} style={{ flex: 1 }}>
                <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${v}%`, background: scoreColor(v), borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 9.5, color: PALETTE.textLow, marginTop: 5, textAlign: "center", fontFamily: MONO, textTransform: "uppercase", letterSpacing: ".02em" }}>
                  {d.short}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div style={{ padding: "16px 24px 26px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.55fr)", gap: 24, alignItems: "start" }} className="sector-open-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ borderRadius: 12, border: `1px solid ${PALETTE.line}`, background: "rgba(10,11,20,0.45)", padding: "14px 12px 6px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ alignSelf: "flex-start", fontSize: 11, color: PALETTE.textLow, fontFamily: MONO, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
                  Profil d&apos;exposition
                </div>
                <RadarChart scores={s.scores} size={224} />
              </div>
              <div style={{ borderRadius: 12, border: `1px solid ${PALETTE.line}`, background: "rgba(10,11,20,0.45)", padding: 14 }}>
                <ControlChain pattern={s.pattern} color={c} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: PALETTE.textLow, fontFamily: MONO, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Cadre réglementaire</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {s.officialSources.map((src) => (
                    <a
                      key={src.url}
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: PALETTE.textMid, textDecoration: "none", border: `1px solid ${PALETTE.line}`, borderRadius: 8, padding: "6px 10px", background: "rgba(10,11,20,0.5)" }}
                    >
                      {src.label} <span style={{ fontSize: 11, color: PALETTE.textLow }}>↗</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="sector-axes-grid">
              <AxisList title="Menaces 2026" tone="#f5b544" items={s.threats2026} />
              <AxisList title="Signaux KYB Graph" tone={ACCENT_SOFT} items={s.kybSignals} />
              <AxisList title="Preuves attendues" tone="#4ade9b" items={s.requiredEvidence} />
              <AxisList title="Limites" tone="#f26d6d" items={s.limitations} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 12.5,
  color: ACCENT_TEXT,
  fontFamily: MONO,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  marginBottom: 8,
};

export default function SectorsExperience() {
  const [active, setActive] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [fams, setFams] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<"intensity" | DimensionKey>("intensity");
  const [q, setQ] = useState("");

  const totalThreats = SECTORS.reduce((a, s) => a + s.threats2026.length + s.kybSignals.length, 0);
  const liveCount = CONNECTORS.filter((c) => c.live).length;
  const maxSector = SECTORS.reduce((a, s) => (s.intensity > a.intensity ? s : a));

  const toggleFam = (f: string) => setFams((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  const filtered = useMemo(() => {
    const list = SECTORS.filter((s) => {
      if (fams.length && !fams.includes(s.family)) return false;
      if (q.trim()) {
        const hay = (s.sector + " " + s.exposure + " " + s.threats2026.join(" ") + " " + s.kybSignals.join(" ")).toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => (sortKey === "intensity" ? b.intensity - a.intensity : b.scores[sortKey] - a.scores[sortKey]));
  }, [fams, q, sortKey]);

  const sortOptions: [string, string][] = [["intensity", "Intensité 2026"], ...DIMENSIONS.map((d) => [d.key, d.label] as [string, string])];
  const statNum: React.CSSProperties = { fontFamily: DISPLAY, fontSize: 38, fontWeight: 700, lineHeight: 1, color: PALETTE.textHi, letterSpacing: "-0.02em" };

  return (
    <div className="landing-scope" style={{ minHeight: "100vh", background: PALETTE.bg0, color: PALETTE.textHi, position: "relative" }}>
      {/* halo + grille de fond */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.5,
          pointerEvents: "none",
          backgroundImage: `linear-gradient(to right, ${ACCENT}0d 1px, transparent 1px), linear-gradient(to bottom, ${ACCENT}0d 1px, transparent 1px)`,
          backgroundSize: "34px 34px",
        }}
      />
      <div
        aria-hidden
        style={{ position: "fixed", top: "-10%", left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: `radial-gradient(ellipse at center, ${ACCENT}28, transparent 70%)`, pointerEvents: "none", filter: "blur(20px)" }}
      />

      {/* top bar */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: `1px solid ${PALETTE.line}`, background: "rgba(7,9,18,0.82)", backdropFilter: "blur(14px)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14, color: PALETTE.textMid, textDecoration: "none", fontWeight: 500 }}>
            <span style={{ fontSize: 17 }}>←</span> KYB Graph
            <span style={{ color: PALETTE.textLow }}>/</span>
            <span style={{ color: PALETTE.textHi }}>Secteurs</span>
          </Link>
          <Link
            href="/cases/demo"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "#04201d", background: ACCENT, borderRadius: 9, padding: "9px 16px", textDecoration: "none", boxShadow: `0 10px 30px ${ACCENT}55` }}
          >
            Ouvrir la démo →
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "56px 32px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.92fr)", gap: 40, alignItems: "center" }} className="hero-grid">
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9, borderRadius: 99, border: `1px solid ${PALETTE.line}`, padding: "6px 14px", fontSize: 12.5, color: ACCENT_TEXT, background: `${ACCENT}10`, marginBottom: 24 }}>
              <span className="kyb-pulse" style={{ width: 6, height: 6, borderRadius: 99, background: "#4ade9b", color: "#4ade9b" }} />
              Conforme LCB-FT · AMLR 2024/1624 · RGPD
            </span>
            <h1 style={{ margin: 0, fontSize: 60, lineHeight: 1.02, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: DISPLAY }} className="hero-title">
              Menaces 2026
              <br />
              <span style={{ color: ACCENT_SOFT }}>par secteur</span>
            </h1>
            <p style={{ margin: "22px 0 0", fontSize: 17.5, lineHeight: 1.65, color: PALETTE.textMid, maxWidth: 540 }}>
              Une matrice vivante pour analystes conformité, audit KYB et due diligence B2B. Chaque secteur expose ce que KYB Graph{" "}
              <strong style={{ color: "#cdd2e6", fontWeight: 600 }}>observe</strong>, quelle <strong style={{ color: "#cdd2e6", fontWeight: 600 }}>preuve</strong> rattacher et ce qui doit rester{" "}
              <strong style={{ color: "#cdd2e6", fontWeight: 600 }}>hors conclusion automatique</strong>.
            </p>
            <div style={{ display: "flex", gap: 30, marginTop: 34, flexWrap: "wrap" }}>
              {([
                [SECTORS.length, "secteurs analysés", ""],
                [DIMENSIONS.length, "dimensions de risque", ""],
                [totalThreats, "signaux catalogués", ""],
                [liveCount, "connecteurs live", `/${CONNECTORS.length}`],
              ] as [number, string, string][]).map(([n, l, sfx]) => (
                <div key={l}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <CountUp to={n} style={statNum} />
                    <span style={{ fontSize: 16, color: PALETTE.textLow, fontFamily: MONO }}>{sfx}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: PALETTE.textLow, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: "relative", height: 480 }} className="hero-orb">
            <div style={{ position: "absolute", top: 14, left: 14, fontSize: 11, color: PALETTE.textLow, fontFamily: MONO, textTransform: "uppercase", letterSpacing: ".08em", zIndex: 2 }}>
              Graphe d&apos;exposition · survolez un nœud
            </div>
            <NetworkConstellation active={active} setActive={setActive} width={560} height={480} />
          </div>
        </div>

        <div style={{ marginTop: 36 }}>
          <SourceStrip />
        </div>
      </section>

      {/* HEATMAP */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
          <div>
            <div style={eyebrow}>Vue d&apos;ensemble</div>
            <h2 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.015em", fontFamily: DISPLAY }}>L&apos;exposition en un coup d&apos;œil</h2>
            <p style={{ margin: "10px 0 0", fontSize: 15, color: PALETTE.textMid, maxWidth: 560, lineHeight: 1.6 }}>
              Croisement secteur × dimension de risque. Survolez une cellule pour le détail ; la ligne s&apos;illumine dans le graphe ci-dessus.
            </p>
          </div>
          <RiskLegend />
        </div>
        <div style={{ borderRadius: 16, border: `1px solid ${PALETTE.line}`, background: "rgba(14,16,32,0.5)", padding: "10px 18px 18px" }}>
          <Heatmap active={active} setActive={setActive} />
        </div>
        <p style={{ fontSize: 12, color: PALETTE.textLow, marginTop: 12, lineHeight: 1.5 }}>
          Modèle de scoring de <strong style={{ color: PALETTE.textMid }}>démonstration</strong> (0-100), à calibrer avec vos analystes. Le secteur le plus exposé est{" "}
          <strong style={{ color: scoreColor(maxSector.intensity) }}>{maxSector.sector}</strong> (intensité {maxSector.intensity}).
        </p>
      </section>

      {/* EXPLORATEUR */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "34px 32px 80px" }}>
        <div style={eyebrow}>Explorer</div>
        <h2 style={{ margin: "0 0 22px", fontSize: 34, fontWeight: 700, letterSpacing: "-0.015em", fontFamily: DISPLAY }}>Chaque secteur en profondeur</h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 22, padding: 14, borderRadius: 14, border: `1px solid ${PALETTE.line}`, background: "rgba(14,16,32,0.5)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
            {FAMILIES.map((f) => {
              const on = fams.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggleFam(f)}
                  style={{
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    padding: "8px 14px",
                    borderRadius: 99,
                    border: `1px solid ${on ? ACCENT : PALETTE.line}`,
                    background: on ? `${ACCENT}2e` : "rgba(10,11,20,0.5)",
                    color: on ? ACCENT_TEXT : PALETTE.textMid,
                    transition: "all .15s",
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: PALETTE.textLow, fontSize: 14 }}>⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une menace, un signal…"
              style={{ width: 240, fontSize: 13, padding: "9px 12px 9px 30px", borderRadius: 9, border: `1px solid ${PALETTE.line}`, background: "rgba(10,11,20,0.6)", color: PALETTE.textHi, outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: PALETTE.textLow }}>Trier par</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as "intensity" | DimensionKey)}
              style={{ fontSize: 13, padding: "9px 12px", borderRadius: 9, border: `1px solid ${PALETTE.line}`, background: "rgba(10,11,20,0.6)", color: PALETTE.textHi, outline: "none", cursor: "pointer" }}
            >
              {sortOptions.map(([k, l]) => (
                <option key={k} value={k} style={{ background: "#11142a" }}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }} className="cards-grid">
          {filtered.map((s) => (
            <SectorCard
              key={s.slug}
              s={s}
              open={openSlug === s.slug}
              onToggle={() => setOpenSlug((p) => (p === s.slug ? null : s.slug))}
              active={active}
              setActive={setActive}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60, color: PALETTE.textLow, fontSize: 15 }}>Aucun secteur ne correspond à ces filtres.</div>
          )}
        </div>
      </section>

      {/* footer disclaimer */}
      <footer style={{ borderTop: `1px solid ${PALETTE.line}`, background: "rgba(7,9,18,0.7)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "30px 32px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 13, color: PALETTE.textLow, maxWidth: 760, lineHeight: 1.6 }}>
            KYB Graph documente des diligences et des hypothèses. Une proximité de graphe n&apos;établit pas une relation juridique : la décision reste{" "}
            <strong style={{ color: PALETTE.textMid }}>humaine, contextualisée et conforme aux droits applicables</strong>.
          </p>
          <span style={{ fontSize: 12, color: PALETTE.textLow, fontFamily: MONO }}>© 2026 KYB Graph</span>
        </div>
      </footer>
    </div>
  );
}
