import * as React from "react"

import { cn } from "@/lib/utils"
import { REVEAL_MAX_GROUPS } from "@/lib/design/motion"

type RevealTag = "div" | "section" | "header" | "aside"

export type RevealProps = React.ComponentProps<"div"> & {
  /**
   * Rang du groupe dans l'ordre d'apparition (0 = immédiat). Borné à
   * REVEAL_MAX_GROUPS : une page apparaît toujours en moins de ~400 ms.
   */
  index?: number
  as?: RevealTag
}

/**
 * Apparition progressive d'une page PAR GROUPES (en-tête, indicateurs, panneaux) :
 * fondu + montée de 4 px, groupes décalés de `--motion-stagger`. 100 % CSS
 * (utilitaire `motion-reveal`) : composant serveur, aucun JavaScript, contenu
 * présent dans le HTML dès le premier octet. `prefers-reduced-motion` : tout
 * apparaît immédiatement (règle globale).
 *
 * À réserver à l'arrivée sur une page : jamais sur un contenu qui se met à jour
 * en continu (liste filtrée, données en direct).
 */
function Reveal({ index = 0, as: Tag = "div", className, style, ...props }: RevealProps) {
  const rank = Math.max(0, Math.min(Math.round(index), REVEAL_MAX_GROUPS))
  return (
    <Tag
      data-slot="reveal"
      className={cn("motion-reveal", className)}
      style={{ ...style, ["--reveal-index" as string]: rank } as React.CSSProperties}
      {...props}
    />
  )
}

export { Reveal }
