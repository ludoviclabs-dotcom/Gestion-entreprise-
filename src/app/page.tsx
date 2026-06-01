import Link from "next/link";

export default function Home() {
  return (
    <main className="bg-grid relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--background)]" />
      <div className="relative z-10 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--emerald)]" />
          MVP1 · Cartographie juridique
        </span>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight">
          KYB Graph
        </h1>
        <p className="mt-4 text-lg text-[var(--muted-foreground)]">
          Comprendre qui contrôle quoi, qui dirige quoi, qui paie qui — et avec
          quel niveau de preuve.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-[var(--violet)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Ouvrir l&apos;application
          </Link>
          <Link
            href="/cases/demo"
            className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface)]"
          >
            Voir la démo
          </Link>
        </div>
        <p className="mt-10 text-xs text-[var(--muted-foreground)]">
          Les liens inférés sont des hypothèses d&apos;analyse, pas des preuves.
        </p>
      </div>
    </main>
  );
}
