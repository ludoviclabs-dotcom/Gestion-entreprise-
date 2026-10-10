import { OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_STYLES } from "@/lib/design/tone";

/**
 * État d'erreur : annoncé immédiatement (`role="alert"`), message sobre et
 * non accusatoire, action de reprise en slot. Composant serveur : le bouton de
 * reprise est fourni par l'appelant (un frontière d'erreur passe son `reset`).
 *
 *   tone="vigilance" — dégradé récupérable (source indisponible, données partielles) ;
 *   tone="critical"  — échec bloquant.
 * `titleAs` : h2 par défaut (état dans une page) ; h1 quand il occupe la page.
 */
export default function ErrorState({
  title = "Cette vue n'a pas pu s'afficher",
  description,
  digest,
  action,
  tone = "vigilance",
  variant = "card",
  titleAs: Title = "h2",
  className,
}: {
  title?: string;
  description?: string;
  /** Identifiant technique (digest Next) — affiché en mono, jamais de détail interne. */
  digest?: string;
  action?: React.ReactNode;
  tone?: "vigilance" | "critical";
  variant?: "card" | "inline";
  titleAs?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const Icon = tone === "critical" ? OctagonAlert : TriangleAlert;
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center px-6 py-8 text-center",
        variant === "card" && "rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <span
        className={cn(
          "mb-3 flex size-10 items-center justify-center rounded-full border",
          TONE_STYLES[tone].soft,
        )}
      >
        <Icon size={18} aria-hidden />
      </span>
      <Title className="font-display text-lg font-semibold">{title}</Title>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {digest ? (
        <p className="mt-2 font-mono text-xs text-subtle">Digest {digest}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
