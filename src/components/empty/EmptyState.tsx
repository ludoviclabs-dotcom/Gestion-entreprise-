import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONE_STYLES, type Tone } from "@/lib/design/tone";

/**
 * État vide : icône + titre + description + action facultative. Utilisé sur la
 * liste des dossiers, les onglets Timeline / Sources / Risques et toute surface
 * qui peut être vide. Famille : EmptyState · LoadingState · ErrorState.
 *
 * `tone` : "neutral" (défaut) = accent d'interaction ; "good" = succès (ex. « rien
 * à signaler ») ; toute autre teinte du design system est acceptée.
 * `titleAs` : élément du titre — `p` par défaut (état vide DANS une page) ;
 * `h1` quand l'état occupe toute la page (404).
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  action,
  tone = "neutral",
  variant = "card",
  titleAs: Title = "p",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Raccourci : lien d'action principal. */
  cta?: { label: string; href: string };
  /** Action libre (prioritaire sur `cta`). */
  action?: React.ReactNode;
  tone?: "neutral" | "good" | Tone;
  /** card : encadré en pointillés ; inline : sans cadre (dans un panneau/tableau). */
  variant?: "card" | "inline";
  titleAs?: "p" | "h1" | "h2" | "h3";
  className?: string;
}) {
  const resolved: Tone = tone === "neutral" ? "accent" : tone === "good" ? "success" : tone;
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center justify-center px-6 py-10 text-center",
        variant === "card" &&
          "rounded-lg border border-dashed border-border-strong bg-surface/40",
        className,
      )}
    >
      <span
        className={cn(
          "mb-3 flex size-10 items-center justify-center rounded-full border",
          TONE_STYLES[resolved].soft,
        )}
      >
        <Icon size={18} aria-hidden />
      </span>
      <Title className="font-display text-base font-semibold">{title}</Title>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
      {action ? (
        <div className="mt-5">{action}</div>
      ) : cta ? (
        <Link href={cta.href} className={cn(buttonVariants({ size: "sm" }), "mt-5")}>
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
