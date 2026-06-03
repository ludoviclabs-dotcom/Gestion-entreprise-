/**
 * Transformation de la réponse brute de l'API RNE/INPI vers le shape simplifié
 * consommé par `normalizeInpi`. Isolé du connecteur réseau pour être testable
 * unitairement sans credentials ni accès HTTP.
 *
 * La structure RNE est profondément imbriquée et varie selon le type de
 * personne (morale / physique). On parse de façon ultra-défensive (optional
 * chaining partout) : aucune forme inattendue ne doit lever d'exception — au
 * pire on retourne des listes vides.
 *
 * Référence : https://registre-national-entreprises.inpi.fr/api (formality →
 * content → personneMorale → composition.pouvoirs + beneficiairesEffectifs).
 * À valider contre des réponses réelles dès que les credentials INPI sont
 * actifs (le compte est validé sous 1-5 jours ouvrés).
 */

export type InpiDirigeant = {
  nom?: string;
  prenoms?: string;
  qualite?: string;
  type: "personne_physique" | "personne_morale";
  denomination?: string;
  siren?: string;
};

export type InpiBeneficiaire = {
  nom?: string;
  prenoms?: string;
  modaliteControle?: string;
};

export type InpiSimplified = {
  siren: string;
  dirigeants: InpiDirigeant[];
  beneficiairesEffectifs: InpiBeneficiaire[];
};

/** Codes de rôle RNE les plus courants → libellé lisible. Fallback : « Dirigeant ». */
const ROLE_LABELS: Record<string, string> = {
  "5300": "Président",
  "5400": "Directeur général",
  "5200": "Directeur général délégué",
  "5100": "Membre du conseil d'administration",
  "0073": "Associé",
  "0030": "Gérant",
  "30": "Gérant",
  "53": "Président",
  "54": "Directeur général",
};

function roleLabel(code: unknown): string | undefined {
  if (typeof code !== "string") return undefined;
  return ROLE_LABELS[code] ?? `Dirigeant (code ${code})`;
}

function joinPrenoms(prenoms: unknown): string | undefined {
  if (Array.isArray(prenoms)) {
    const joined = prenoms.filter((p) => typeof p === "string").join(" ").trim();
    return joined || undefined;
  }
  if (typeof prenoms === "string") return prenoms.trim() || undefined;
  return undefined;
}

type Json = Record<string, unknown>;

function asObject(v: unknown): Json | undefined {
  return v && typeof v === "object" ? (v as Json) : undefined;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function parsePouvoir(pouvoir: unknown): InpiDirigeant | null {
  const p = asObject(pouvoir);
  if (!p) return null;

  // Dirigeant personne morale (société qui dirige).
  const entreprise = asObject(p.entreprise);
  if (entreprise) {
    return {
      type: "personne_morale",
      denomination:
        asString(entreprise.denomination) ?? asString(entreprise.nom),
      siren: asString(entreprise.siren),
      qualite: roleLabel(p.roleEntreprise ?? entreprise.roleEntreprise),
    };
  }

  // Dirigeant personne physique.
  const individu = asObject(p.individu);
  const desc = asObject(individu?.descriptionPersonne) ?? asObject(p.descriptionPersonne);
  if (desc) {
    return {
      type: "personne_physique",
      nom: asString(desc.nom),
      prenoms: joinPrenoms(desc.prenoms),
      qualite: roleLabel(desc.role ?? p.roleEntreprise),
    };
  }
  return null;
}

function parseBeneficiaire(be: unknown): InpiBeneficiaire | null {
  const b = asObject(be);
  if (!b) return null;
  const benef = asObject(b.beneficiaire) ?? b;
  const desc = asObject(benef.descriptionPersonne);
  if (!desc) return null;
  const modalite = asObject(benef.modaliteControle);
  const parts =
    asString(modalite?.pourcentageParts) ??
    (modalite?.detentionPartTotale === true ? "Détention totale" : undefined);
  return {
    nom: asString(desc.nom),
    prenoms: joinPrenoms(desc.prenoms),
    modaliteControle: parts,
  };
}

/**
 * Extrait dirigeants + bénéficiaires effectifs d'une réponse RNE brute.
 * Tolère l'absence de chaque niveau ; ne lève jamais.
 */
export function transformRne(raw: unknown, siren: string): InpiSimplified {
  const root = asObject(raw);
  const content = asObject(asObject(root?.formality)?.content);
  const personneMorale = asObject(content?.personneMorale);
  const personnePhysique = asObject(content?.personnePhysique);

  const dirigeants: InpiDirigeant[] = [];
  const beneficiairesEffectifs: InpiBeneficiaire[] = [];

  // Pouvoirs (personne morale).
  const composition = asObject(personneMorale?.composition);
  for (const pouvoir of asArray(composition?.pouvoirs)) {
    const d = parsePouvoir(pouvoir);
    if (d && (d.nom || d.denomination)) dirigeants.push(d);
  }

  // Entrepreneur individuel (personne physique).
  const identitePP = asObject(asObject(personnePhysique?.identite)?.entrepreneur);
  const descPP = asObject(identitePP?.descriptionPersonne);
  if (descPP) {
    const nom = asString(descPP.nom);
    const prenoms = joinPrenoms(descPP.prenoms);
    if (nom || prenoms) {
      dirigeants.push({
        type: "personne_physique",
        nom,
        prenoms,
        qualite: "Entrepreneur individuel",
      });
    }
  }

  // Bénéficiaires effectifs (UBO).
  for (const be of asArray(personneMorale?.beneficiairesEffectifs)) {
    const b = parseBeneficiaire(be);
    if (b && (b.nom || b.prenoms)) beneficiairesEffectifs.push(b);
  }

  return { siren, dirigeants, beneficiairesEffectifs };
}
