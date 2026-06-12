import sireneUniteLegale from "@/lib/fixtures/sirene-unite-legale.sample.json";
import sireneEtablissement from "@/lib/fixtures/sirene-etablissement.sample.json";
import sireneSearch from "@/lib/fixtures/sirene-search.sample.json";
import bodaccSample from "@/lib/fixtures/bodacc.sample.json";
import inpiRne from "@/lib/fixtures/inpi-rne.sample.json";
import tresorGels from "@/lib/fixtures/tresor-gels.sample.json";
import openSanctions from "@/lib/fixtures/opensanctions.sample.json";

/**
 * Résolution endpoint fixture → payload brut d'exemple.
 *
 * Deux conventions coexistent :
 *  - les connecteurs en mode démo nomment leurs endpoints précisément
 *    (`fixture:sirene-unite-legale`, `fixture:inpi-rne:<siren>`, …) ;
 *  - les dossiers de démonstration (`demoSources()`) utilisent l'alias
 *    générique `fixture:<kind>` (`fixture:sirene`, `fixture:inpi`, …).
 *
 * Sert l'inspecteur de preuve (payload brut affiché) et les seeds du journal
 * (payloadHash des sources de démo). Module serveur uniquement.
 */
const BY_ENDPOINT: Record<string, unknown> = {
  // Endpoints précis des connecteurs (mode démo).
  "fixture:sirene-unite-legale": sireneUniteLegale,
  "fixture:sirene-etablissement": sireneEtablissement,
  "fixture:sirene-search": sireneSearch,
  "fixture:bodacc": bodaccSample,
  "fixture:bodacc(repli)": bodaccSample,
  "fixture:tresor-gels": tresorGels,
  "fixture:opensanctions": openSanctions,
  // Alias génériques des dossiers de démonstration (demoSources).
  "fixture:sirene": sireneUniteLegale,
  "fixture:inpi": inpiRne,
  "fixture:tresor_gels": tresorGels,
};

export function resolveFixturePayload(endpoint: string): unknown | null {
  if (endpoint in BY_ENDPOINT) return BY_ENDPOINT[endpoint];
  // `fixture:inpi-rne:<siren>` — suffixe variable.
  if (endpoint.startsWith("fixture:inpi-rne")) return inpiRne;
  return null;
}
