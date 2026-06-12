/**
 * Contenus statiques embarqués dans l'Evidence Pack ZIP : le script de
 * vérification hors-ligne (`verify.mjs`, Node ≥ 18 sans aucune dépendance)
 * et le LISEZMOI. Le script reproduit volontairement la matière hachée de
 * `src/lib/audit/hash-chain.ts` (computeEntryHash / canonicalJson) — toute
 * évolution du chaînage doit être répercutée ici.
 */

export const VERIFY_SCRIPT = `// Vérification hors-ligne d'un Evidence Pack KYB Graph.
// Usage : node verify.mjs   (depuis le dossier extrait du ZIP)
// 1) Recalcule le SHA-256 de chaque fichier listé dans manifest.json.
// 2) Rejoue la chaîne de hash de audit-trail.json (journal append-only).
// Sortie : code 0 si tout est intègre, 1 sinon.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const here = new URL(".", import.meta.url);
const read = (name) => readFileSync(new URL(name, here));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// Miroir de canonicalJson (clés triées récursivement) — cf. hash-chain.ts.
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}
const canonicalJson = (value) => JSON.stringify(sortKeys(value));

let ok = true;
const fail = (message) => {
  ok = false;
  console.error("ECHEC  " + message);
};

// --- 1. Empreintes des fichiers du pack -----------------------------------
const manifest = JSON.parse(read("manifest.json").toString("utf8"));
for (const [name, expected] of Object.entries(manifest.files ?? {})) {
  let actual;
  try {
    actual = sha256(read(name));
  } catch {
    fail("fichier manquant : " + name);
    continue;
  }
  if (actual === expected) console.log("OK     " + name);
  else fail("empreinte differente : " + name);
}

// --- 2. Rejeu de la chaîne du journal --------------------------------------
const trail = JSON.parse(read("audit-trail.json").toString("utf8"));
let prev = "0".repeat(64);
for (let i = 0; i < trail.length; i++) {
  const entry = trail[i];
  if (entry.prevHash !== prev) {
    fail("journal : rebouclage prevHash rompu a l'entree " + (i + 1));
    break;
  }
  const material = [
    entry.prevHash,
    entry.caseId,
    String(entry.seq),
    entry.kind,
    entry.occurredAt,
    canonicalJson(entry.payload),
  ].join("\\n");
  if (sha256(material) !== entry.entryHash) {
    fail("journal : entryHash invalide a l'entree " + (i + 1));
    break;
  }
  prev = entry.entryHash;
}
if (ok) console.log("OK     journal : chaine de " + trail.length + " entree(s) integre");
if (
  manifest.chainHead &&
  trail.length > 0 &&
  trail[trail.length - 1].entryHash !== manifest.chainHead
) {
  fail("journal : la tete de chaine ne correspond pas a manifest.chainHead");
}

console.log(ok ? "\\nPack integre." : "\\nPack ALTERE ou incomplet.");
process.exit(ok ? 0 : 1);
`;

export function buildLisezmoi(args: {
  titre: string;
  rootSiren: string;
  generatedAt: string;
}): string {
  return [
    "EVIDENCE PACK — KYB Graph",
    "==========================",
    "",
    `Dossier   : ${args.titre}`,
    `SIREN     : ${args.rootSiren}`,
    `Généré le : ${args.generatedAt}`,
    "",
    "Contenu :",
    "  manifest.json     Métadonnées + empreinte SHA-256 de chaque fichier",
    "                    + tête de chaîne du journal (chainHead).",
    "  report.pdf        Rapport du dossier (sources, niveaux de preuve).",
    "  report-data.json  Données complètes (bundle, sources, evidence) pour rejeu.",
    "  audit-trail.json  Journal de preuve append-only hash-chaîné.",
    "  verify.mjs        Script de vérification hors-ligne (sans dépendance).",
    "",
    "Vérification (Node.js ≥ 18) :",
    "  node verify.mjs",
    "",
    "Le script recalcule l'empreinte de chaque fichier et rejoue la chaîne de",
    "hash du journal. Toute altération du pack est signalée et le code de",
    "sortie passe à 1.",
    "",
    "Niveaux de preuve : confirmé / déclaré / inféré / simulé — les éléments",
    "inférés ou simulés sont des hypothèses d'analyse, jamais des preuves.",
    "",
  ].join("\n");
}
