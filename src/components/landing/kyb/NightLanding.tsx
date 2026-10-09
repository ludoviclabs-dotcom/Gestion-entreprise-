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
} from "./content";
import { FicheNight, HeroGraph } from "./LandingState.client";
import ThreatDot from "./ThreatDot";

/** Direction 1b « Nuit » — mode nuit (thème sombre). */

const ANCHORS = [
  { n: "01", label: "Preuve", href: "#preuve-b" },
  { n: "02", label: "Sources", href: "#sources-b" },
  { n: "03", label: "Scores", href: "#scores-b" },
];

const LEGEND = [
  { label: "Confirmé", line: "1.6px solid var(--ink)" },
  { label: "Déclaré", line: "1px solid var(--line)" },
  { label: "Inféré", line: "1.6px dashed var(--warn)" },
  { label: "Simulé", line: "2px dotted var(--simule)" },
];

const PROOF_MARK = {
  confirme: { line: "2px solid var(--ink)", dot: { background: "var(--ink)" } },
  declare: { line: "1px solid var(--line)", dot: { border: "1.5px solid var(--ink)" } },
  infere: { line: "2px dashed var(--warn)", dot: { border: "1.5px dashed var(--warn)" } },
  simule: { line: "2px dotted var(--simule)", dot: { border: "2px dotted var(--simule)" } },
} as const;

function Brand({ size }: { size: "lg" | "sm" }) {
  return (
    <Link href="/" className={`b-brand b-brand-${size}`}>
      <span className="b-brand-mark">
        <span />
      </span>
      <span>KYB Graph</span>
    </Link>
  );
}

function Cta() {
  return (
    <>
      <Link href="/dashboard" className="b-btn">
        <span>Ouvrir l&apos;application</span>
        <span aria-hidden>→</span>
      </Link>
      <Link href="/demo" className="b-link-under">
        <span>Voir la démo</span>
        <span aria-hidden>↗</span>
      </Link>
    </>
  );
}

function Nav({ footer }: { footer?: boolean }) {
  return (
    <nav className={footer ? "b-nav b-footer-nav" : "b-nav"} aria-label={footer ? "Pied de page" : "Navigation principale"}>
      {PUBLIC_NAV.map((i) => (
        <Link key={i.href} href={i.href}>
          {i.label}
        </Link>
      ))}
      {footer && <Link href="/dashboard">Application</Link>}
    </nav>
  );
}

export default function NightLanding() {
  return (
    <div className="kgl-b" data-screen-label="1b Nuit">
      <header className="b-header">
        <div className="b-header-in">
          <Brand size="lg" />
          <Nav />
          <div className="b-header-cta">
            <Link href="/dashboard" className="b-login">
              Connexion
            </Link>
            <Link href="/dashboard" className="b-btn b-btn-sm">
              Ouvrir l&apos;application
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero : graphe plein cadre, texte à gauche, fiche en bas à droite ── */}
        <section className="b-hero">
          <div className="b-hero-graph">
            <HeroGraph variant="b" />
          </div>
          <div className="b-hero-fade-x" aria-hidden />
          <div className="b-hero-fade-y" aria-hidden />
          <div className="b-hero-in">
            <div className="b-hero-text">
              <div className="b-badge">
                <span className="b-dot" />
                <span>{COMPLIANCE}</span>
              </div>
              <h1 className="b-h1">KYB Graph</h1>
              <p className="b-sub">Cartographie de conformité KYB</p>
              <p className="b-tagline">
                <strong>Prouver ce que l&apos;on sait.</strong> <span>Signaler ce qui reste à vérifier.</span>
              </p>
              <div className="b-anchors">
                {ANCHORS.map((a) => (
                  <a key={a.href} href={a.href}>
                    <span className="b-accent">{a.n}</span>
                    <span>{a.label}</span>
                  </a>
                ))}
              </div>
              <div className="b-cta">
                <Cta />
              </div>
            </div>

            <div className="b-hero-foot">
              <div className="b-hero-legend">
                <div className="b-legend">
                  {LEGEND.map((l) => (
                    <span key={l.label}>
                      <span style={{ width: 22, borderTop: l.line }} />
                      <span>{l.label}</span>
                    </span>
                  ))}
                </div>
                <span className="b-muted">Holding Patrimoniale — démonstration · SIREN 900 111 222 · 7 entités · 9 liens</span>
              </div>
              <FicheNight />
            </div>
          </div>
        </section>

        {/* ── Piliers ── */}
        <section className="b-band">
          <div className="b-pillars">
            {PILLARS.map((p, i) => (
              <div key={p.title} data-reveal="" data-delay={i * 80}>
                <div className="b-pillar-title">
                  <span className="b-dot" />
                  <span>{p.title}</span>
                </div>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 01 Preuve ── */}
        <section id="preuve-b" className="b-band b-anchor">
          <div className="b-wrap b-pad-proof">
            <div data-reveal="" className="b-head-row">
              <div>
                <div className="b-kicker">01 / Preuve</div>
                <h2 className="b-h2-xl">Quatre niveaux de preuve</h2>
              </div>
              <p className="b-intro-side">{PROOF_INTRO}</p>
            </div>
            <div className="b-scroll-x" style={{ marginTop: 96 }}>
              <div className="b-proof-grid">
                {PROOF_LEVELS.map((p, i) => (
                  <div key={p.id} data-reveal="" data-delay={i * 120}>
                    <div className="b-proof-mark">
                      <span className="b-proof-dot" style={PROOF_MARK[p.id].dot} />
                      <span style={{ flex: 1, borderTop: PROOF_MARK[p.id].line }} />
                    </div>
                    {p.verify ? (
                      <div className="b-proof-name-row">
                        <span className="b-proof-name">{p.label}</span>
                        <span className="b-verify">à vérifier</span>
                      </div>
                    ) : (
                      <div className="b-proof-name b-proof-name-solo">{p.label}</div>
                    )}
                    <p>{p.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 Sources ── */}
        <section id="sources-b" className="b-band b-anchor">
          <div className="b-wrap b-split">
            <div data-reveal="" className="b-split-head">
              <div className="b-kicker">02 / Sources</div>
              <h2 className="b-h2">Sources officielles</h2>
              <p className="b-intro">{SOURCES_INTRO}</p>
            </div>
            <div className="b-split-body">
              {SOURCES.map((s, i) => (
                <div key={s.name} data-reveal="" data-delay={i * 60} className="b-source-row">
                  <span className="b-source-name">{s.name}</span>
                  <span className="b-source-meta">
                    <span>{s.text}</span>
                    <span className="b-accent b-mono-sm">{s.access}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 03 Scores ── */}
        <section id="scores-b" className="b-band b-anchor">
          <div className="b-wrap b-pad-scores">
            <div data-reveal="" className="b-head-row">
              <div>
                <div className="b-kicker">03 / Scores</div>
                <h2 className="b-h2-xl">Trois scores labellisés</h2>
              </div>
              <p className="b-intro-side">{SCORES_INTRO}</p>
            </div>
            <div className="b-scores">
              {SCORES.map((s, i) => (
                <div key={s.name} data-reveal="" data-delay={i * 120}>
                  <div className="b-ruler" />
                  <div className="b-ruler-ends">
                    <span>0</span>
                    <span>100</span>
                  </div>
                  <div className="b-score-name">{s.name}</div>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
            <p className="b-mono-muted" style={{ margin: "56px 0 0" }}>
              {SCORE_MODEL}
            </p>
          </div>
        </section>

        {/* ── Menaces par secteur ── */}
        <section className="b-band">
          <div className="b-wrap b-pad">
            <div data-reveal="" className="b-head-row">
              <div style={{ maxWidth: 620 }}>
                <div className="b-kicker">Secteurs</div>
                <h2 className="b-h2">Menaces 2026 par secteur</h2>
                <p className="b-intro">{THREAT_INTRO}</p>
              </div>
              <Link href="/secteurs" className="b-link-under b-link-sm">
                <span>Voir l&apos;analyse complète</span>
                <span aria-hidden>↗</span>
              </Link>
            </div>
            <div className="b-scroll-x" style={{ marginTop: 72 }}>
              <div className="b-threat">
                <div className="b-threat-row b-threat-head">
                  {THREAT_HEAD.map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
                {THREAT_ROWS.map((r, i) => (
                  <div key={r.sector} data-reveal="" data-delay={i * 70} className="b-threat-row b-threat-body">
                    <div>
                      <div className="b-threat-sector">{r.sector}</div>
                      <div className="b-threat-scope">{r.scope}</div>
                    </div>
                    {r.cells.map((c, j) => (
                      <ThreatDot key={j} t={c} />
                    ))}
                    <span className={`b-mono-12${r.intensity === "Critique" ? " b-warn" : ""}`}>{r.intensity} ↗</span>
                  </div>
                ))}
                <div className="kgl-threat-legend">
                  <span><ThreatDot t="m" /><span>Modéré</span></span>
                  <span><ThreatDot t="e" /><span>Élevé</span></span>
                  <span className="kgl-threat-legend-c"><ThreatDot t="c" /><span>Critique</span></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Calendrier réglementaire (vertical, titre collant) ── */}
        <section className="b-band">
          <div className="b-wrap b-split b-split-top">
            <div data-reveal="" className="b-split-head b-sticky">
              <div className="b-kicker">Réglementation</div>
              <h2 className="b-h2">Calendrier réglementaire</h2>
            </div>
            <div className="b-split-body">
              {TIMELINE.map((t, i) => (
                <div key={t.year} style={{ display: "contents" }}>
                  {t.future && !TIMELINE[i - 1]?.future && (
                    <div data-reveal="" className="b-today">
                      <span className="b-dot b-dot-7" />
                      <span>Aujourd&apos;hui</span>
                    </div>
                  )}
                  <div data-reveal="" className={`b-tl-row${i === TIMELINE.length - 1 ? " b-tl-last" : ""}`}>
                    <span className={`b-tl-year${t.future ? " b-muted" : ""}`}>{t.year}</span>
                    <span className="b-mono-muted b-mono-12">{t.date}</span>
                    <p>{t.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Conclusion ── */}
        <section className="b-band">
          <div className="b-wrap b-closing">
            <h2 data-reveal="">
              <span>Prouver ce que l&apos;on sait.</span> <span className="b-muted">Signaler ce qui reste à vérifier.</span>
            </h2>
            <p data-reveal="" data-delay={100} className="b-closing-note">
              La décision reste humaine.
            </p>
            <div data-reveal="" data-delay={200} className="b-cta b-cta-center">
              <Cta />
            </div>
          </div>
        </section>
      </main>

      <footer className="b-band">
        <div className="b-wrap b-footer">
          <div className="kgl-footer-top">
            <div className="kgl-footer-brand">
              <Brand size="sm" />
              <p>Cartographie de conformité KYB.</p>
            </div>
            <Nav footer />
          </div>
          <p className="b-legal">
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
