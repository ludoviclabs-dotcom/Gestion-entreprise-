"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/**
 * Variante SSR-safe de `useReducedMotion`. `useSyncExternalStore` utilise le
 * snapshot serveur (`false`) au rendu serveur ET au premier rendu d'hydratation
 * — la sortie cliente correspond donc toujours au HTML serveur — puis bascule
 * sur la vraie préférence juste après l'hydratation.
 *
 * On évite ainsi le mismatch d'hydratation que provoque la lecture « eager » de
 * `matchMedia` par `motion/react` (serveur sans matchMedia → `false`, client
 * d'un utilisateur reduced-motion → `true`).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
