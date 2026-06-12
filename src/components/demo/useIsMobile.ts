"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/**
 * Détection mobile SSR-safe (même approche que `landing/useReducedMotion`) :
 * snapshot serveur `false`, vraie valeur juste après l'hydratation. Sert à
 * basculer les cartes d'alerte de la démo en barre du bas (< 768 px).
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
