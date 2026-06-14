import { env, isDemoMode } from "@/lib/env";
import fixture from "@/lib/fixtures/docling.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur Docling — extraction structurée de Kbis / statuts / comptes PDF
 * par un sidecar Python (IBM Docling, MIT, exécution locale). Contrat
 * documenté dans docs/docling-extraction.md.
 *
 * Mode mock : en démo OU sans DOCLING_BASE_URL → fixture (Kbis d'exemple).
 * Le service Python reste à la charge de l'utilisateur (souveraineté locale).
 */
function shouldMock(): boolean {
  return isDemoMode() || !env.DOCLING_BASE_URL;
}

export const docling = {
  async extract(file: File): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: fixture,
        endpoint: "fixture:docling",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const url = `${env.DOCLING_BASE_URL}/extract`;
    const form = new FormData();
    form.append("file", file, file.name);
    // Timeout + contrôle res.ok (la route enveloppe d'un try/catch → 502).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Docling a répondu ${res.status}.`);
      const data = await res.json();
      return { raw: data, endpoint: url, httpStatus: res.status, isFixture: false };
    } finally {
      clearTimeout(timer);
    }
  },
};
