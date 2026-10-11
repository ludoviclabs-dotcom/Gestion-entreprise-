import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * En-tête de page : un seul H1 par vue, gabarit unique (remplace les cinq
 * variantes ad hoc relevées à l'audit). Titre en police d'affichage 2xl / bold
 * (usage actuel de l'application), légende facultative au-dessus, description et
 * actions en-dessous / à droite.
 *
 * Les actions : une seule action PRIMAIRE (Button par défaut), le reste en
 * outline/ghost.
 */
export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
  as: Heading = "h1",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Légende en capitales au-dessus du titre (section, objet parent). */
  eyebrow?: ReactNode;
  /** Zone d'actions alignée à droite (passe sous le titre en mobile). */
  actions?: ReactNode;
  /** Ligne de métadonnées sous la description (pastilles, dates, SIREN). */
  meta?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      {/* Base de 20 rem : sur petit écran, les actions passent SOUS le titre au lieu de le casser. */}
      <div className="min-w-0 flex-[1_1_20rem]">
        {eyebrow ? <p className="text-eyebrow mb-1.5">{eyebrow}</p> : null}
        <Heading className="font-display text-2xl font-bold text-foreground">
          {title}
        </Heading>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
