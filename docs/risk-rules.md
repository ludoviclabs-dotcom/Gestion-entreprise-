# Glossaire des règles de risque

KYB Graph calcule des **signaux de vigilance** sur le graphe d'un dossier. Chaque règle est :
- **pure** (fonction `(RuleContext) → CaseRiskSignal[]`),
- **explicable** (chaque signal porte une phrase FR lisible),
- **configurable** (seuils centralisés dans `DEFAULT_THRESHOLDS`).

**Aucune règle ne qualifie un dossier de « fraude ».** Le vocabulaire est imposé : *complexité, vigilance, qualité de preuve*.

Code : `src/lib/risk/{types,rules,engine}.ts` · Tests : `src/tests/unit/risk-rules.spec.ts`.

## Catalogue (`DEFAULT_RULES`)

### 1. `DIRIGEANT_MULTI_SOCIETES`
| | |
|---|---|
| Catégorie | complexité |
| Déclencheur | une personne `DIRIGE` ≥ N sociétés |
| Seuils | medium = 3 · high = 5 |
| Sévérité | medium si ≥3, high si >5 |
| Justification | Un dirigeant qui empile les mandats peut signaler une structure complexe ou un nominee. |
| Format FR | « {nom} est lié·e à {n} sociétés du dossier (seuil {threshold}). » |

### 2. `ADRESSE_PARTAGEE`
| | |
|---|---|
| Catégorie | vigilance |
| Déclencheur | une adresse `PARTAGE_ADRESSE` reçue de ≥ N sociétés |
| Seuils | medium = 2 · high = 5 |
| Sévérité | medium si ≥2, high si >5 |
| Justification | Adresse de domiciliation partagée par plusieurs sociétés sans lien explicite (groupe ou activité commune) — concentration de domiciliation à vérifier (substance économique). |
| Format FR | « {n} sociétés déclarent la même adresse : {adresse}. » |

### 3. `SOCIETE_RECENTE_TRES_LIEE`
| | |
|---|---|
| Catégorie | vigilance |
| Déclencheur | société créée < N mois ET degré graphe ≥ K |
| Seuils | months = 12 · minDegree = 4 |
| Sévérité | medium |
| Justification | Une société toute jeune mais déjà très intriquée dans le réseau d'un groupe peut signaler une mise en place de structure d'évasion ou de portage. |
| Format FR | « Société créée il y a {n} mois et déjà fortement reliée (degré {d}). » |

### 4. `PROCEDURE_COLLECTIVE`
| | |
|---|---|
| Catégorie | vigilance |
| Déclencheur | au moins un événement BODACC `kind === 'procedure_collective'` |
| Sévérité | high |
| Justification | Procédure de redressement ou liquidation publiée — fait juridique opposable. Affecte la valeur de la cible KYB. |
| Format FR | « Procédure collective publiée au BODACC le {date}. » |

### 5. `RADIATION`
| | |
|---|---|
| Catégorie | vigilance |
| Déclencheur | événement BODACC `kind === 'radiation'` |
| Sévérité | high |
| Justification | Radiation du RCS — la société n'existe plus juridiquement. |
| Format FR | « Radiation du RCS publiée au BODACC le {date}. » |

### 6. `CYCLE_DETENTION`
| | |
|---|---|
| Catégorie | vigilance |
| Déclencheur | composante fortement connexe (Tarjan SCC) de taille ≥ 2 sur le sous-graphe `DETIENT` |
| Sévérité | high |
| Justification | Détention circulaire entre sociétés : A détient B qui détient C qui détient A. Structure rarement innocente, recommandée à la déclaration UBO sous AMLR. |
| Format FR | « Cycle de détention détecté entre {n} sociétés ({A → B → C}). » |

### 7. `PIVOT_SUSPECT`
| | |
|---|---|
| Catégorie | vigilance |
| Déclencheur | betweenness centrality normalisée > 0.4, sur graphe ≥ 5 entités |
| Sévérité | medium si >0.4, high si >0.7 |
| Justification | Un nœud pivot relie des sous-réseaux qui seraient sinon disjoints — typique d'un *nominee*, d'un dirigeant-paille ou d'une société-relais. |
| Format FR | « {label} occupe une position de pivot inhabituelle (centralité d'intermédiarité {pct}%). » |

Les entités de type `address` et `event` sont exclues (rôle structurel par nature).

### 8. `ECART_UBO_DECLARE`
| | |
|---|---|
| Catégorie | vigilance |
| Déclencheur | bénéficiaires effectifs déclarés disponibles ET divergence avec l'UBO recalculé depuis le capital |
| Sévérité | high |
| Justification | L'AMLR impose une vigilance renforcée sur les écarts de registre. KYB Graph compare le déclaratif RNE/INPI au contrôle indirect recalculé. |
| Format FR | « Écart de bénéficiaire effectif : {n} déclaré(s), {m} recalculé(s) ≥ 25 %, {d} divergence(s). » |

Le signal reste agrégé: l'exposition nominative de vrais UBO doit rester derrière authentification, rôles et journal d'intérêt légitime.

### 9. `PROXIMITE_SANCTION`
| | |
|---|---|
| Catégorie | vigilance |
| Déclencheur | société ou personne à ≤ 2 sauts d'une entité sanction/PEP dans le graphe |
| Sévérité | high si 1 saut, medium si 2 sauts |
| Justification | Le screening par liste ne suffit pas toujours: une proximité de réseau peut signaler une revue renforcée, sans établir un fait juridique. |
| Format FR | « {label} est à {d} sauts d'une entité signalée (sanction/PEP), via {label} ({lien}). » |

Les homonymies et chemins de proximité sont des signaux à confirmer. Un chemin de graphe ne vaut pas qualification juridique.

## Scoring (3 axes)

Calculé dans `engine.ts:computeRisk`. Version publique persistée dans les métadonnées et exports: `SCORE_MODEL_VERSION = "kyb-risk-2026.1"`.

### Complexité (0–100)
Score structurel : `clamp(densité × 22 + log2(n+1) × 8 + log2(maxDegree+1) × 8)`.

- Dossier solo (1 société, 0 lien) → < 20.
- Réseau dense (5+ sociétés, 15+ liens, degré max ≥ 8) → > 70.

### Vigilance (0–100)
Somme pondérée des sévérités de signaux : `info=1, low=3, medium=7, high=15`, normalisée par cap à 40 → 100.

- Dossier propre → score < 15.
- Procédure collective seule → ~40.
- Procédure collective + cycle + sanction → > 80.

### Qualité de preuve (0–100)
Pourcentage de nœuds + arêtes + événements `confirmed | declared` (vs `inferred | simulated`).

- Dossier 100% sources officielles → 100.
- Dossier avec sanction simulée + lien inféré → ~75.

## Seuils — où les modifier

Tous les seuils sont centralisés dans `src/lib/risk/types.ts` (`DEFAULT_THRESHOLDS`). Pour les surcharger sans toucher au code des règles :

```ts
import { computeRisk, DEFAULT_THRESHOLDS } from "@/lib/risk/engine";

const customThresholds = {
  ...DEFAULT_THRESHOLDS,
  dirigeantMultiSocietes: { medium: 2, high: 4 }, // plus strict
};
const { signals, scores } = computeRisk(bundle, graph, {
  thresholds: customThresholds,
});
```

## Ajouter une règle

1. Définir l'objet `Rule` dans `rules.ts` (id, label, category, fonction `evaluate`).
2. L'ajouter au tableau `DEFAULT_RULES`.
3. Documenter le seuil dans `types.ts:Thresholds` si paramétrable.
4. Compléter `risk-rules.spec.ts` (cas seuil, format FR).
5. Mettre à jour ce glossaire.

> Garde-fou : aucune règle ne doit utiliser le mot « fraude » dans son `explanation`. Un test grep dans la CI valide cette règle.
