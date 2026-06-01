import type { LucideIcon } from "lucide-react";
import Link from "next/link";

/**
 * Composant générique d'état vide : icône + titre + description + CTA facultatif.
 * Utilisé sur la liste des dossiers, les onglets Timeline / Sources / Risques
 * et toute future surface qui peut être vide.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  tone?: "neutral" | "good";
}) {
  const accent = tone === "good" ? "var(--emerald)" : "var(--violet)";
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center">
      <span
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: `${accent}1f`, color: accent }}
      >
        <Icon size={18} />
      </span>
      <p className="font-[family-name:var(--font-display)] text-base font-semibold">
        {title}
      </p>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
