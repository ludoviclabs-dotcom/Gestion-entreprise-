import { FlaskConical } from "lucide-react";

/**
 * Bandeau persistant des parcours (cadrage §9.1) : tout ce qui suit est un cas
 * fictif de formation. Collé en haut de l'écran pour traverser toutes les vues.
 */
export function FictionBanner() {
  return (
    <div
      role="note"
      className="sticky top-0 z-40 border-b border-amber/40 bg-surface px-6 py-2"
    >
      <p className="mx-auto flex max-w-6xl items-center gap-2 text-xs text-foreground">
        <FlaskConical size={14} className="shrink-0 text-amber-700 dark:text-amber" aria-hidden />
        <span>
          <strong className="font-semibold text-amber-700 dark:text-amber">Cas fictif, formation.</strong>{" "}
          Noms, pièces et montants sont inventés ; rien ici ne qualifie une personne ou une
          entreprise réelle.
        </span>
      </p>
    </div>
  );
}
