"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Plateformes Apple : la touche de commande est ⌘, ailleurs Ctrl. */
export function isApplePlatform(userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(userAgent);
}

/**
 * Libellé de la touche modificatrice du raccourci de recherche (« ⌘ » ou « Ctrl »).
 * Le serveur ne connaît pas la plateforme : il rend « Ctrl », puis le client
 * corrige après hydratation sans erreur de concordance (useSyncExternalStore).
 */
export function useModKey(): "⌘" | "Ctrl" {
  return useSyncExternalStore(
    noopSubscribe,
    () => (isApplePlatform(navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
