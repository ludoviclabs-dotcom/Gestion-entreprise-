import { createHash } from "node:crypto";

/**
 * Chaînage de hash du journal de preuve (Étape 3.4 « audit_logs »).
 *
 * Chaque entrée du journal embarque le hash de l'entrée précédente
 * (`prevHash`) dans sa propre matière hachée (`entryHash`) : modifier ou
 * supprimer une entrée passée casse toutes les suivantes — `verifyChain`
 * le détecte. Module serveur uniquement (node:crypto).
 */

/** Hash de genèse : « entrée précédente » de la première entrée d'une chaîne. */
export const GENESIS_HASH = "0".repeat(64);

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Sérialisation JSON canonique : clés triées récursivement. Un même payload
 * produit toujours les mêmes octets — donc le même hash — quel que soit
 * l'ordre d'insertion des clés.
 *
 * NB : les exports JSON/PDF conservent leur `payloadHash` historique calculé
 * sur `JSON.stringify` (ordre d'insertion) ; les deux sérialisations
 * coexistent volontairement (cf. docs/data-model.md).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** SHA-256 d'un contenu binaire (fichiers de l'Evidence Pack). */
export function sha256Bytes(input: Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Hash « convention source_records » : chaîne hachée verbatim, objet haché
 * via JSON.stringify (ordre d'insertion). Identique au helper historique de
 * DbCasesRepository — permet de corroborer journal ↔ source_records.payload_hash.
 */
export function payloadHash(input: unknown): string {
  const buf = typeof input === "string" ? input : JSON.stringify(input);
  return sha256(buf);
}

type ChainEntryMaterial = {
  caseId: string;
  seq: number;
  kind: string;
  occurredAt: string; // ISO 8601, haché verbatim
  payload: Record<string, unknown>;
  prevHash: string;
};

/** Matière hachée d'une entrée : champs ordonnés, séparés par '\n'. */
export function computeEntryHash(entry: ChainEntryMaterial): string {
  const material = [
    entry.prevHash,
    entry.caseId,
    String(entry.seq),
    entry.kind,
    entry.occurredAt,
    canonicalJson(entry.payload),
  ].join("\n");
  return sha256(material);
}

export type ChainVerdict = { ok: true } | { ok: false; brokenAt: number };

/**
 * Vérifie l'intégrité d'une chaîne ordonnée par `seq` croissant :
 * rebouclage `prevHash` + recalcul de chaque `entryHash`.
 * `brokenAt` : index (0-based) de la première entrée invalide.
 */
export function verifyChain(
  entries: Array<ChainEntryMaterial & { entryHash: string }>,
): ChainVerdict {
  let expectedPrev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.prevHash !== expectedPrev) return { ok: false, brokenAt: i };
    if (computeEntryHash(entry) !== entry.entryHash) {
      return { ok: false, brokenAt: i };
    }
    expectedPrev = entry.entryHash;
  }
  return { ok: true };
}
