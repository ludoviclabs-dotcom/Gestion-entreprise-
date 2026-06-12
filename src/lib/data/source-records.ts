import { fixtureCasesById } from "@/lib/fixtures/cases";
import { resolveFixturePayload } from "@/lib/fixtures/sample-payloads";
import { payloadHash } from "@/lib/audit/hash-chain";
import type { SourceRecordDetail } from "./types";

/**
 * Enregistrements source des dossiers de démonstration : le payload brut est
 * le fichier d'exemple résolu par endpoint (`fixture:<nom>`), à défaut
 * l'endpoint lui-même — même convention que les seeds du journal
 * (src/lib/audit/fixture-journal.ts), pour que les empreintes se corroborent.
 * Partagé par les deux repositories (fixtures servies aussi en mode BDD).
 */
export function fixtureSourceRecordDetails(caseId: string): SourceRecordDetail[] {
  const fixture = fixtureCasesById.get(caseId);
  if (!fixture) return [];
  return fixture.sources.map((s) => {
    const payload = resolveFixturePayload(s.endpoint) ?? s.endpoint;
    return {
      source: s.source,
      endpoint: s.endpoint,
      httpStatus: s.httpStatus,
      isFixture: s.isFixture,
      payload,
      payloadHash: payloadHash(payload),
    };
  });
}
