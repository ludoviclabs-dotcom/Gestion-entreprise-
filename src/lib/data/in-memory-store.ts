import type { CaseDetail } from "./types";

/**
 * Store module-level pour les dossiers créés en session (mode démo, sans BDD).
 * NON persistant : vidé au redémarrage du process, non partagé entre workers.
 * Suffisant pour une démo mono-utilisateur ; remplacé par Neon en phase secondaire.
 */
const store = new Map<string, CaseDetail & { updatedAt: string }>();

export const sessionStore = {
  set(id: string, detail: CaseDetail & { updatedAt: string }): void {
    store.set(id, detail);
  },
  get(id: string): (CaseDetail & { updatedAt: string }) | undefined {
    return store.get(id);
  },
  all(): Array<[string, CaseDetail & { updatedAt: string }]> {
    return Array.from(store.entries());
  },
  has(id: string): boolean {
    return store.has(id);
  },
  /** Enregistre/met à jour la synthèse manuelle d'un dossier (Claude Code). */
  setSynthesis(id: string, content: string): boolean {
    const entry = store.get(id);
    if (!entry) return false;
    const updatedAt = new Date().toISOString();
    entry.bundle.case.synthesis = { content, updatedAt };
    entry.updatedAt = updatedAt;
    return true;
  },
};
