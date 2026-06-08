import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  DatabaseZap,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Grid2X2,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  Maximize2,
  Network,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const NAV_ITEMS = ["Produit", "Fonctionnalités", "Cas d'usage", "Ressources", "Tarifs"];

const PROOF_MARKERS = [
  { label: "Preuve", icon: FileText, className: "text-sky-300" },
  { label: "Sources", icon: DatabaseZap, className: "text-emerald" },
  { label: "Scores", icon: ShieldCheck, className: "text-amber" },
];

const TRUST_POINTS = [
  {
    title: "Traçabilité complète",
    text: "Chaîne de preuve horodatée",
    icon: ShieldCheck,
  },
  {
    title: "Cadre réglementaire",
    text: "Aligné LCB-FT, RGPD et normes internes",
    icon: Scale,
  },
  {
    title: "Analyse approfondie",
    text: "Graphes relationnels et signaux contextuels",
    icon: Network,
  },
  {
    title: "Contrôle et confidentialité",
    text: "Données sécurisées, accès maîtrisés",
    icon: LockKeyhole,
  },
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

function AppMockup() {
  const navItems = [
    { label: "Tableau de bord", icon: LayoutDashboard },
    { label: "Dossiers", icon: FolderOpen, active: true },
    { label: "Analyses", icon: Network },
    { label: "Alertes", icon: Bell },
    { label: "Sources", icon: FileText },
    { label: "Paramètres", icon: Settings },
  ];

  return (
    <div
      data-qa="app-mockup"
      className="relative h-[552px] overflow-hidden rounded-md border border-white/10 bg-[#0a1227]/95 shadow-[0_26px_90px_rgba(0,0,0,0.34)]"
    >
      <div className="absolute inset-0 bg-grid opacity-70" />
      <div className="relative grid h-full grid-cols-[158px_1fr]">
        <aside className="border-r border-white/10 bg-[#071026]/72 px-3 py-4">
          <div className="flex items-center gap-2 px-1 text-sm font-semibold text-white">
            <BrandMark className="h-6 w-6" />
            KYB Graph
          </div>
          <nav className="mt-6 space-y-1">
            {navItems.map(({ label, icon: Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium ${
                  active
                    ? "bg-white/8 text-white"
                    : "text-slate-400"
                }`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </div>
            ))}
          </nav>
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
            Mode live
          </div>
        </aside>

        <section className="relative min-w-0 px-4 py-3">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex h-7 w-[260px] items-center gap-2 rounded-md border border-white/10 bg-[#071026]/70 px-3 text-xs text-slate-500">
              <Search size={14} />
              Rechercher...
              <span className="ml-auto rounded border border-white/10 px-1 text-[10px] text-slate-500">
                ⌘K
              </span>
            </div>
            <Settings size={16} className="text-slate-400" />
          </div>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/6 text-slate-300">
                  <ArrowRight size={15} className="rotate-180" />
                </span>
                <div>
                  <h2 className="text-base font-semibold leading-tight text-white">
                    Holding Patrimoniale — démonstration
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    SIREN 900111222 · 7 entités · 9 liens
                  </p>
                </div>
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-emerald">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                  Prêt
                </span>
              </div>
              <div className="mt-4 flex gap-5 text-xs font-medium text-slate-400">
                <span className="border-b-2 border-violet pb-2 text-white">Graphe</span>
                <span>Preuve</span>
                <span>Sources</span>
                <span>Scores</span>
                <span>Analyse</span>
              </div>
            </div>
            <Link
              href="/cases/demo"
              className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/6 hover:text-white"
            >
              <Download size={14} />
              Exporter
            </Link>
          </div>

          <div className="relative mt-2 h-[288px] overflow-hidden">
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full text-slate-500/70"
              viewBox="0 0 660 318"
              fill="none"
            >
              <path d="M120 218L238 136L342 58L456 120L565 149" stroke="currentColor" />
              <path d="M238 136L455 120L445 30" stroke="currentColor" />
              <path d="M238 136L120 205M238 136L180 56M455 120L570 198" stroke="currentColor" />
              <path d="M455 120L525 170" stroke="#f59e0b" />
            </svg>
            <GraphNode className="left-[14%] top-[58%]" dotClassName="bg-slate-300" label="Jugement judiciaire (BODACC)" muted />
            <GraphNode className="left-[15%] top-[31%]" dotClassName="bg-slate-400" label="8 avenue du Parc, 69006 Lyon" muted />
            <GraphNode className="left-[31%] top-[43%]" dotClassName="bg-blue-300" label="SCI DU PARC" strong />
            <GraphNode className="left-[43%] top-[18%]" dotClassName="bg-pink-300" label="Jean MARTIN" strong />
            <GraphNode className="left-[56%] top-[5%]" dotClassName="bg-blue-300" label="SCI LES TILLEULS" strong />
            <GraphNode className="left-[58%] top-[39%]" dotClassName="bg-blue-300" label="HOLDING PATRIMONIALE SAS" strong />
            <GraphNode className="left-[80%] top-[39%]" dotClassName="bg-yellow-400" label="Immatriculation RCS" />
            <GraphNode className="left-[66%] top-[58%]" dotClassName="bg-orange-400" label="Correspondance « MARTIN HOLDING LTD »" />
            <GraphNode className="left-[37%] top-[74%]" dotClassName="bg-yellow-400" label="Immatriculation RCS" />
            <div className="absolute right-1 top-8 space-y-2">
              {[ZoomIn, ZoomOut, Maximize2, Grid2X2, Layers].map((Icon, index) => (
                <span
                  key={index}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#071026]/70 text-slate-400"
                >
                  <Icon size={15} />
                </span>
              ))}
            </div>
          </div>

          <div className="grid min-h-[102px] grid-cols-[1fr_132px_1fr] overflow-hidden rounded-md border border-white/10 bg-[#0c1730]/92">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-white">
                HOLDING PATRIMONIALE SAS
              </h3>
              <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
                {[
                  ["Type", "Société"],
                  ["SIREN", "900 111 222"],
                  ["Statut", "Active"],
                  ["Pays", "France"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-slate-500">{label}</p>
                    <p className="mt-1 font-medium text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-x border-white/10 p-3">
              <p className="whitespace-nowrap text-xs text-slate-400">Score de conformité</p>
              <p className="mt-1 text-3xl font-semibold text-emerald">
                78
                <span className="text-sm font-normal text-slate-400"> /100</span>
              </p>
              <p className="mt-1 text-xs text-amber">• Moyen</p>
            </div>
            <div className="p-3">
              <p className="text-xs text-slate-400">Résumé</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Structure complexe avec liens personnes et correspondances.
                Vérifications complémentaires recommandées.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function GraphNode({
  className,
  dotClassName,
  label,
  strong = false,
  muted = false,
}: {
  className: string;
  dotClassName: string;
  label: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <span className={`absolute flex items-center gap-2 ${className}`}>
      <span
        className={`h-4 w-4 rounded-full ${dotClassName} ${
          strong ? "ring-4 ring-white/10" : ""
        }`}
      />
      <span
        className={`whitespace-nowrap text-[10px] font-medium ${
          muted ? "text-slate-300" : "text-white"
        }`}
      >
        {label}
      </span>
    </span>
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
    <main className="min-h-screen bg-[#070f20] text-slate-100">
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
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#071024] to-transparent"
        />
        <div className="relative z-10 mx-auto grid min-h-[626px] max-w-[1800px] items-center gap-8 py-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="pt-2">
            <h1 className="font-[family-name:var(--font-display)] text-6xl font-bold leading-none text-white md:text-7xl lg:text-[76px]">
              KYB Graph
            </h1>
            <p className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-slate-300 md:text-[34px] lg:whitespace-nowrap">
              Cartographie de conformité KYB
            </p>
            <p className="mt-3 max-w-[580px] text-xl leading-8 text-slate-400">
              Prouver ce que l'on sait. Signaler ce qui reste à vérifier.
            </p>

            <div className="mt-10 flex flex-wrap gap-x-12 gap-y-4">
              {PROOF_MARKERS.map(({ label, icon: Icon, className }) => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-3 text-lg font-semibold ${className}`}
                >
                  <Icon size={25} strokeWidth={2} />
                  {label}
                </span>
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

            <div className="mt-10 grid max-w-[620px] grid-cols-2 gap-5 sm:grid-cols-4">
              {TRUST_POINTS.map(({ title, text, icon: Icon }) => (
                <div key={title} className="min-w-0">
                  <Icon size={25} className="text-slate-400" />
                  <h2 className="mt-4 text-sm font-semibold leading-5 text-white">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <AppMockup />
          </div>
        </div>
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
