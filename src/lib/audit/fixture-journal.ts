import { fixtureCases } from "@/lib/fixtures/cases";
import { resolveFixturePayload } from "@/lib/fixtures/sample-payloads";
import type { ProofEvent } from "./journal";
import { buildCreationProofEvents } from "./journal";

/**
 * Journaux de preuve des dossiers de démonstration.
 *
 * Générés une fois par process à partir des fixtures, avec des horodatages
 * FIXES (1 h avant le `updatedAt` de chaque dossier) : le seed est
 * déterministe et la chaîne se vérifie réellement en mode démo zéro-clé.
 * Même doctrine d'éphémérité que `sessionStore` (non persistant).
 */
const cache = new Map<string, ProofEvent[]>();
let seeded = false;

function seedAll(): void {
  if (seeded) return;
  seeded = true;
  for (const fc of fixtureCases) {
    const caseId = fc.bundle.case.id;
    const occurredAt = new Date(
      Date.parse(fc.updatedAt) - 3_600_000,
    ).toISOString();
    const events = buildCreationProofEvents({
      caseId,
      bundle: fc.bundle,
      sources: fc.sources.map((s) => ({
        source: s.source,
        endpoint: s.endpoint,
        httpStatus: s.httpStatus,
        isFixture: s.isFixture,
        // Payload d'exemple si l'endpoint est résolu, sinon l'endpoint
        // lui-même (hash stable dans les deux cas).
        raw: resolveFixturePayload(s.endpoint) ?? s.endpoint,
      })),
      occurredAt,
    });
    cache.set(caseId, events);
  }
}

/** Journal seedé d'un dossier fixture — `[]` pour tout autre id. */
export function seedJournalFor(caseId: string): ProofEvent[] {
  seedAll();
  return cache.get(caseId) ?? [];
}
