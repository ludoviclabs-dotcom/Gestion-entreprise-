import Link from "next/link";
import { PUBLIC_NAV } from "@/components/site/nav-items";
import {
  COMPLIANCE,
  PILLARS,
  PROOF_INTRO,
  PROOF_LEVELS,
  SCORES,
  SCORES_INTRO,
  SCORE_MODEL,
  SOURCES,
  SOURCES_INTRO,
  THREAT_HEAD,
  THREAT_INTRO,
  THREAT_ROWS,
  TIMELINE,
  TODAY_POS,
} from "./content";
import { FicheDay, HeroGraph } from "./LandingState.client";
import ThreatDot from "./ThreatDot";

/** Direction 1a « Registre » — mode jour (thème clair). */

const ANCHORS = [
  { n: "01", label: "Preuve", href: "#preuve-a" },
  { n: "02", label: "Sources", href: "#sources-a" },
  { n: "03", label: "Scores", href: "#scores-a" },
];

const LEGEND = [
  { label: "Confirmé", line: "1.6px solid var(--ink)" },
  { label: "Déclaré", line: "1px solid var(--line)" },
  { label: "Inféré", line: "1.6px dashed var(--warn)" },
  { label: "Simulé", line: "2px dotted var(--ink2)" },
];

/** Marqueur (trait + pastille) de chaque niveau de preuve. */
const PROOF_MARK = {
  confirme: { line: "1.6px solid var(--ink)", dot: { background: "var(--ink)" } },
  declare: { line: "1px solid var(--line)", dot: { border: "1.5px solid var(--ink)" } },
  infere: { line: "1.6px dashed var(--warn)", dot: { border: "1.5px dashed var(--warn)" } },
  simule: { line: "2px dotted var(--ink2)", dot: { border: "2px dotted var(--ink2)" } },
} as const;

function Brand({ size }: { size: "lg" | "sm" }) {
  return (
    <Link href="/" className={`a-brand a-brand-${size}`}>
      <span className="a-brand-mark">
        <span />
      </span>
      <span>KYB Graph</span>
    </Link>
  );
}

function Cta() {
  return (
    <>
      <Link href="/dashboard" className="a-btn">
        <span>Ouvrir l&apos;application</span>
        <span aria-hidden>→</span>
      </Link>
      <Link href="/demo" className="a-link-under">
        <span>Voir la démo</span>
        <span aria-hidden>↗</span>
      </Link>
    </>
  );
}

function SectionHead({ id, kicker, title, intro, children }: { id?: string; kicker: string; title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div data-reveal="" className="a-head" id={id}>
      <div className="a-kicker">{kicker}</div>
      <h2 className="a-h2">{title}</h2>
      {intro && <p className="a-intro">{intro}</p>}
      {children}
    </div>
  );
}

export default function DayLanding() {
  return (
    <div className="kgl-a" data-screen-label="1a Registre">
      <header className="a-header">
        <div className="a-header-in">
          <Brand size="lg" />
          <nav className="a-nav" aria-label="Navigation principale">
            {PUBLIC_NAV.map((i) => (
              <Link key={i.href} href={i.href}>
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="a-header-cta">
            <Link href="/dashboard" className="a-login">
              Connexion
            </Link>
            <Link href="/dashboard" className="a-btn a-btn-sm">
              Ouvrir l&apos;application
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero : texte + graphe sans cadre + fiche en bande ── */}
        <section className="a-hero">
          <div className="a-hero-text">
            <div className="a-badge">
              <span className="a-dot" />
              <span>{COMPLIANCE}</span>
            </div>
            <h1 className="a-h1">KYB Graph</h1>
            <p className="a-sub">Cartographie de conformité KYB</p>
            <p className="a-tagline">
              <strong>Prouver ce que l&apos;on sait.</strong> <span>Signaler ce qui reste à vérifier.</span>
            </p>
            <div className="a-anchors">
              {ANCHORS.map((a) => (
                <a key={a.href} href={a.href}>
                  <span className="a-accent">{a.n}</span>
                  <span>{a.label}</span>
                </a>
              ))}
            </div>
            <div className="a-cta">
              <Cta />
            </div>
          </div>

          <div className="a-hero-graph">
            <div className="a-graph-head">
              <div className="a-graph-title">
                <span>Holding Patrimoniale — démonstration</span>
                <span>SIREN 900 111 222 · 7 entités · 9 liens</span>
              </div>
              <div className="a-legend">
                {LEGEND.map((l) => (
                  <span key={l.label}>
                    <span style={{ width: 22, borderTop: l.line }} />
                    <span>{l.label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="a-graph">
              <HeroGraph variant="a" />
              <span className="a-graph-hint">Survoler un nœud : niveau de preuve · Cliquer : fiche entité</span>
            </div>
            <FicheDay />
          </div>
        </section>

        {/* ── Piliers ── */}
        <section className="a-pillars">
          <div className="a-pillars-in">
            {PILLARS.map((p, i) => (
              <div key={p.title} data-reveal="" data-delay={i * 80}>
                <div className="a-pillar-rule" />
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 01 Preuve ── */}
        <section id="preuve-a" className="a-split a-split-first">
          <SectionHead kicker="01 · Preuve" title="Quatre niveaux de preuve" intro={PROOF_INTRO} />
          <div className="a-split-body">
            {PROOF_LEVELS.map((p, i) => (
              <div key={p.id} data-reveal="" data-delay={i * 80} className="a-proof-row">
                <div className="a-proof-mark">
                  <span style={{ flex: 1, borderTop: PROOF_MARK[p.id].line }} />
                  <span className="a-proof-dot" style={PROOF_MARK[p.id].dot} />
                </div>
                {p.verify ? (
                  <div className="a-proof-name-col">
                    <span className="a-proof-name">{p.label}</span>
                    <span className="a-verify">à vérifier</span>
                  </div>
                ) : (
                  <div className="a-proof-name">{p.label}</div>
                )}
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 02 Sources ── */}
        <section id="sources-a" className="a-split">
          <SectionHead kicker="02 · Sources" title="Sources officielles" intro={SOURCES_INTRO} />
          <div className="a-split-body">
            {SOURCES.map((s, i) => (
              <div key={s.name} data-reveal="" data-delay={i * 60} className="a-source-row">
                <span className="a-source-name">{s.name}</span>
                <span className="a-source-text">{s.text}</span>
                <span className="a-mono-muted">{s.access}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 03 Scores ── */}
        <section id="scores-a" className="a-split a-split-last">
          <SectionHead kicker="03 · Scores" title="Trois scores labellisés" intro={SCORES_INTRO}>
            <p className="a-mono-muted a-score-model">{SCORE_MODEL}</p>
          </SectionHead>
          <div className="a-scores">
            {SCORES.map((s, i) => (
              <div key={s.name} data-reveal="" data-delay={i * 100} className="a-score">
                <div className="a-mono-muted">0 — 100</div>
                <div className="a-score-name">{s.name}</div>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Menaces par secteur ── */}
        <section className="a-band">
          <div className="a-split a-split-flat">
            <div data-reveal="" className="a-head a-head-col">
              <div className="a-kicker">Secteurs</div>
              <h2 className="a-h2">Menaces 2026 par secteur</h2>
              <p className="a-intro">{THREAT_INTRO}</p>
              <Link href="/secteurs" className="a-link-under a-threat-link">
                <span>Voir l&apos;analyse complète</span>
                <span aria-hidden>↗</span>
              </Link>
            </div>
            <div className="a-split-body a-scroll-x">
              <div className="a-threat">
                <div className="a-threat-row a-threat-head">
                  {THREAT_HEAD.map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
                {THREAT_ROWS.map((r, i) => (
                  <div key={r.sector} data-reveal="" data-delay={i * 70} className="a-threat-row a-threat-body">
                    <div>
                      <div className="a-threat-sector">{r.sector}</div>
                      <div className="a-threat-scope">{r.scope}</div>
                    </div>
                    {r.cells.map((c, j) => (
                      <ThreatDot key={j} t={c} />
                    ))}
                    <span className={`a-threat-int${r.intensity === "Critique" ? " a-warn" : ""}`}>{r.intensity} ↗</span>
                  </div>
                ))}
                <div className="kgl-threat-legend">
                  <span><ThreatDot t="m" decorative /><span>Modéré</span></span>
                  <span><ThreatDot t="e" decorative /><span>Élevé</span></span>
                  <span className="kgl-threat-legend-c"><ThreatDot t="c" decorative /><span>Critique</span></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Calendrier réglementaire ── */}
        <section className="a-band">
          <div className="a-timeline-wrap">
            <div data-reveal="" style={{ maxWidth: 640 }}>
              <div className="a-kicker">Réglementation</div>
              <h2 className="a-h2">Calendrier réglementaire</h2>
            </div>
            <div className="a-scroll-x" style={{ marginTop: 64 }}>
              <div className="a-timeline">
                <div className="a-tl-base" />
                <div data-reveal="x" className="a-tl-past" style={{ width: TODAY_POS }} />
                <div className="a-tl-today" style={{ left: TODAY_POS }}>
                  <span>Aujourd&apos;hui</span>
                  <span />
                </div>
                <div className="a-tl-grid">
                  {TIMELINE.map((t, i) => (
                    <div key={t.year} data-reveal="" data-delay={i * 90} className="a-tl-item">
                      <span className={`a-tl-dot${t.future ? " a-tl-dot-future" : ""}`} />
                      <div className="a-tl-year">{t.year}</div>
                      <div className="a-mono-muted a-tl-date">{t.date}</div>
                      <p>{t.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Conclusion ── */}
        <section className="a-band a-band-ink">
          <div className="a-closing">
            <h2 data-reveal="">
              <span>Prouver ce que l&apos;on sait, signaler ce qui reste à vérifier.</span>{" "}
              <span className="a-muted">La décision reste humaine.</span>
            </h2>
            <div data-reveal="" data-delay={120} className="a-cta">
              <Cta />
            </div>
          </div>
        </section>
      </main>

      <footer className="a-band">
        <div className="a-footer">
          <div className="kgl-footer-top">
            <div className="kgl-footer-brand">
              <Brand size="sm" />
              <p>Cartographie de conformité KYB.</p>
            </div>
            <nav className="a-nav a-footer-nav" aria-label="Pied de page">
              {PUBLIC_NAV.map((i) => (
                <Link key={i.href} href={i.href}>
                  {i.label}
                </Link>
              ))}
              <Link href="/dashboard">Application</Link>
            </nav>
          </div>
          <p className="a-legal">
            <span>
              {COMPLIANCE}. Démonstrateur sur données fictives anonymisées — trajectoire d&apos;hébergement souverain
              détaillée sur la page{" "}
            </span>
            <Link href="/souverainete">Souveraineté</Link>
            <span>.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
