import Link from "next/link";
import { ArrowRight, ArrowUpRight, ExternalLink, Network } from "lucide-react";
import AmbientGraph from "@/components/landing/AmbientGraph.client";
import ProductPanel from "@/components/landing/ProductPanel.client";
import FeatureGrid from "@/components/landing/FeatureGrid.client";
import ProofBadge from "@/components/landing/ProofBadge";

const NAV_ITEMS = ["Produit", "Fonctionnalités", "Cas d'usage", "Ressources", "Tarifs"];

const PROOF_MARKERS = [
  { label: "Preuve", color: "var(--kyb-green)" },
  { label: "Sources", color: "var(--kyb-violet-soft)" },
  { label: "Scores", color: "var(--kyb-amber)", pulse: true },
];

const THREAT_ROWS = [
  {
    sector: "Immobilier",
    scope: "Transaction & gestion",
    cells: ["amber", "amber", "yellow", "amber"] as const,
    trend: "high",
  },
  {
    sector: "Commerce international",
    scope: "Import / Export",
    cells: ["red", "amber", "yellow", "red"] as const,
    trend: "critical",
  },
  {
    sector: "Banque & finance",
    scope: "Entrée en relation",
    cells: ["yellow", "red", "red", "amber"] as const,
    trend: "high",
  },
  {
    sector: "Achats fournisseurs",
    scope: "Supply chain critique",
    cells: ["red", "yellow", "amber", "red"] as const,
    trend: "critical",
  },
];

type RiskTone = (typeof THREAT_ROWS)[number]["cells"][number];

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center text-violet ${className}`}
      aria-hidden
    >
      <Network size={30} strokeWidth={2.3} />
    </span>
  );
}

function RiskDot({ tone }: { tone: RiskTone }) {
  const classes = {
    amber: "bg-orange-400 shadow-orange-400/25",
    yellow: "bg-yellow-400 shadow-yellow-400/25",
    red: "bg-orange-500 shadow-orange-500/25",
  };

  return (
    <span
      className={`mx-auto block h-4 w-4 rounded-full shadow-[0_0_24px] ${classes[tone]}`}
      aria-hidden
    />
  );
}

function ThreatMatrix() {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-[#0a1227]/72">
      <div className="grid grid-cols-[1.4fr_repeat(5,1fr)] border-b border-white/10 text-xs text-slate-300">
        {[
          "Secteur",
          "Risque pays",
          "Complexité structurelle",
          "Exposition PEP",
          "Opacité propriété",
          "Intensité 2026",
        ].map((heading) => (
          <div key={heading} className="border-r border-white/10 px-4 py-4 last:border-r-0">
            {heading}
          </div>
        ))}
      </div>
      {THREAT_ROWS.map((row) => (
        <div
          key={row.sector}
          className="grid grid-cols-[1.4fr_repeat(5,1fr)] border-b border-white/8 text-sm last:border-b-0"
        >
          <div className="border-r border-white/10 px-4 py-3">
            <p className="font-medium text-slate-100">{row.sector}</p>
            <p className="mt-1 text-xs text-slate-400">{row.scope}</p>
          </div>
          {row.cells.map((tone, index) => (
            <div
              key={`${row.sector}-${index}`}
              className="flex items-center border-r border-white/10 px-4 py-3"
            >
              <RiskDot tone={tone} />
            </div>
          ))}
          <div className="flex items-center justify-center px-4 py-3 text-orange-400">
            <ArrowUpRight size={22} strokeWidth={2.2} />
            <span className="sr-only">{row.trend}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="landing-scope min-h-screen bg-[var(--kyb-bg0)] text-[var(--kyb-text-hi)]">
      <header className="relative z-20 border-b border-white/8 bg-[#070f20]/95 px-6 sm:px-8">
        <div className="mx-auto flex h-[74px] max-w-[1800px] items-center justify-between gap-5">
          <Link href="/" className="flex items-center gap-3 whitespace-nowrap text-xl font-bold text-white sm:text-2xl">
            <BrandMark />
            KYB Graph
          </Link>
          <nav className="hidden items-center gap-11 text-sm font-medium text-slate-300 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item} href="/secteurs" className="transition hover:text-white">
                {item}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden rounded-md border border-white/12 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/6 sm:inline-flex"
            >
              Connexion
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center whitespace-nowrap rounded-md bg-violet px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_35px_rgba(124,58,237,0.34)] transition hover:bg-violet/90"
            >
              Ouvrir l'application
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/8 px-6 sm:px-8">
        <div className="absolute inset-0 bg-grid opacity-85" aria-hidden />
        <AmbientGraph />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#071024] to-transparent"
        />
        <div className="relative z-10 mx-auto grid min-h-[626px] max-w-[1800px] items-center gap-8 py-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="pt-2">
            <span
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--kyb-line)] px-3 py-[5px] text-xs text-[var(--kyb-violet-soft)]"
              style={{ background: "color-mix(in srgb, var(--kyb-violet) 6%, transparent)" }}
            >
              <span
                className="kyb-pulse h-1.5 w-1.5 rounded-full"
                style={{ color: "var(--kyb-green)", backgroundColor: "var(--kyb-green)" }}
              />
              Conforme LCB-FT · AMLR 2024/1624 · RGPD
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-6xl font-bold leading-none text-white md:text-7xl lg:text-[76px]">
              KYB Graph
            </h1>
            <p className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-slate-300 md:text-[34px] lg:whitespace-nowrap">
              Cartographie de conformité KYB
            </p>
            <p className="mt-3 max-w-[580px] text-xl leading-8 text-slate-400">
              <strong className="text-white">Prouver ce que l'on sait.</strong>{" "}
              Signaler ce qui reste à vérifier.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {PROOF_MARKERS.map((marker) => (
                <ProofBadge
                  key={marker.label}
                  label={marker.label}
                  color={marker.color}
                  pulse={marker.pulse}
                />
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex min-w-[246px] items-center justify-center gap-4 rounded-md bg-violet px-6 py-4 text-base font-semibold text-white shadow-[0_15px_40px_rgba(124,58,237,0.35)] transition hover:bg-violet/90"
              >
                Ouvrir l'application <ArrowRight size={20} />
              </Link>
              <Link
                href="/cases/demo"
                className="inline-flex min-w-[200px] items-center justify-center gap-4 rounded-md border border-white/14 bg-[#0a1227]/70 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/6"
              >
                Voir la démo <ExternalLink size={18} />
              </Link>
            </div>
          </div>

          <ProductPanel />
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-14 sm:px-8">
        <FeatureGrid />
      </section>

      <section className="border-b border-white/8 bg-[#091327] px-6 py-10 sm:px-8">
        <div className="mx-auto grid max-w-[1800px] gap-8 lg:grid-cols-[0.95fr_1.7fr]">
          <div className="flex flex-col justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white">
                Menaces 2026 par secteur
              </h2>
              <p className="mt-5 max-w-[520px] text-sm leading-7 text-slate-400">
                Vue synthétique des niveaux de menaces observés par secteur
                d'activité pour orienter la priorisation des contrôles et la
                couverture des diligences.
              </p>
            </div>
            <Link
              href="/secteurs"
              className="mt-8 inline-flex w-fit items-center gap-3 rounded-md border border-white/12 bg-[#0a1227]/65 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/6"
            >
              Voir l'analyse complète <ExternalLink size={16} />
            </Link>
          </div>
          <ThreatMatrix />
        </div>
      </section>
    </main>
  );
}
