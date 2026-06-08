import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  DatabaseZap,
  Download,
  FileJson,
  GitBranch,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { FEATURED_SECTOR_PROFILES } from "@/lib/domain/sector-threats";

const PROOF_STEPS = [
  {
    title: "Sources",
    text: "Sirene, BODACC, RNE/INPI, gels et sources documentees restent visibles avec statut live, mixed ou demo.",
    icon: DatabaseZap,
  },
  {
    title: "Graphe",
    text: "Entites, dirigeants, liens de controle, adresses et evenements sont relies avec un niveau de preuve.",
    icon: GitBranch,
  },
  {
    title: "Scores",
    text: "Complexite, vigilance et qualite de preuve sont calcules sans vocabulaire accusatoire.",
    icon: ShieldCheck,
  },
  {
    title: "Exports",
    text: "PDF et JSON embarquent sources, preuves, modele de score et limites d'interpretation.",
    icon: Download,
  },
];

function GraphBackdrop() {
  const nodes = [
    ["left-[13%] top-[18%] h-16 w-16 border-sky-400/50 bg-sky-400/15", "RNE"],
    ["left-[29%] top-[42%] h-24 w-24 border-violet/60 bg-violet/15", "UBO"],
    ["left-[52%] top-[20%] h-20 w-20 border-emerald/60 bg-emerald/15", "SIREN"],
    ["left-[68%] top-[50%] h-16 w-16 border-amber/60 bg-amber/15", "BODACC"],
    ["left-[82%] top-[24%] h-14 w-14 border-red/60 bg-red/15", "GELS"],
  ];
  const lines = [
    "left-[20%] top-[32%] w-[23%] rotate-[19deg]",
    "left-[39%] top-[38%] w-[22%] -rotate-[28deg]",
    "left-[59%] top-[38%] w-[20%] rotate-[31deg]",
    "left-[70%] top-[35%] w-[15%] -rotate-[19deg]",
  ];

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-80" />
      {lines.map((line) => (
        <span
          key={line}
          className={`absolute hidden h-px origin-left bg-gradient-to-r from-violet/10 via-foreground/30 to-emerald/10 sm:block ${line}`}
        />
      ))}
      {nodes.map(([classes, label]) => (
        <span
          key={label}
          className={`absolute hidden items-center justify-center rounded-full border text-[10px] font-semibold tracking-normal text-foreground/80 shadow-[0_0_40px_rgba(124,58,237,0.18)] sm:flex ${classes}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative flex min-h-[82vh] items-center overflow-hidden px-6 py-16">
        <GraphBackdrop />
        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-normal text-emerald">
              Demo Compliance B2B 2026
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-bold tracking-normal sm:text-6xl">
              KYB Graph
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Cartographier les beneficiaires effectifs, les liens de controle,
              les signaux sanctions et la qualite de preuve pour presenter un
              dossier KYB clair, prudent et exploitable par une equipe
              conformite.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/cases/demo"
                className="inline-flex items-center gap-2 rounded-lg bg-violet px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                Ouvrir la demo <ArrowRight size={16} />
              </Link>
              <Link
                href="/secteurs"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-2"
              >
                Menaces par secteur
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-4">
          {PROOF_STEPS.map(({ title, text, icon: Icon }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-background p-4"
            >
              <Icon className="text-violet" size={20} />
              <h2 className="mt-4 font-[family-name:var(--font-display)] text-base font-semibold">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">
                Une posture preuve prudente
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Le produit ne transforme pas un signal en accusation. Les liens
                inferes et simules restent marques comme hypotheses, les sources
                fixture restent visibles, et les UBO nominatifs reels restent
                derriere authentification, roles et journal d'interet legitime.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-lg border border-emerald/35 bg-emerald/10 px-3 py-1 text-emerald">
                  computed / partial / missing
                </span>
                <span className="rounded-lg border border-amber/35 bg-amber/10 px-3 py-1 text-amber">
                  live / mixed / fixture
                </span>
                <span className="rounded-lg border border-red/35 bg-red/10 px-3 py-1 text-red">
                  limites juridiques explicites
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4">
                <BadgeCheck className="text-emerald" size={20} />
                <h3 className="mt-3 font-semibold">UBO recalcule</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Controle indirect et ecarts declaratifs exposes comme signaux
                  a revoir, avec preuve et version de modele.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <Scale className="text-amber" size={20} />
                <h3 className="mt-3 font-semibold">Conformite AMLR</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Lecture risk-based adaptee aux dossiers KYB, fournisseurs et
                  due diligence B2B.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <FileJson className="text-sky-400" size={20} />
                <h3 className="mt-3 font-semibold">Export auditable</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Manifest JSON et rapport PDF incluent hash, evidence,
                  sourceHealth et scoreStatus.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <ShieldCheck className="text-red" size={20} />
                <h3 className="mt-3 font-semibold">Sanctions</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Proximite de graphe et homonymies affichees comme elements a
                  confirmer, pas comme fait etabli.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold">
                Menaces 2026 par secteur
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Banque, immobilier, audit, achats, secteur public, logistique,
                sante et commodities: chaque secteur a ses signaux KYB, preuves
                requises et limites d'interpretation.
              </p>
            </div>
            <Link
              href="/secteurs"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Voir la matrice <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FEATURED_SECTOR_PROFILES.map((profile) => (
              <article
                key={profile.slug}
                className="rounded-lg border border-border bg-background p-4"
              >
                <h3 className="font-semibold">{profile.sector}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {profile.threats2026[0]}
                </p>
                <p className="mt-4 text-xs font-medium text-emerald">
                  Signal: {profile.kybSignals[0]}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
