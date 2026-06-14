# Audit des calculs — ÉTAPE 0 (calculé vs en dur)

> Vérification préalable BLOQUANTE avant l'ÉTAPE 1. Méthode : lecture directe du
> code de calcul (`src/lib/risk/engine.ts`, `src/lib/graph/ubo.ts`,
> `src/lib/graph/algorithms.ts`) et des points d'affichage (`ScorePills`,
> `cases/[caseId]/layout.tsx`, onglets analyse/risques, fixtures, /secteurs, landing).

## Synthèse

| Élément affiché | Calculé ? | Preuve | Décomposable dans l'UI ? |
|---|---|---|---|
| Score **complexité** | ✅ Calculé (formule) | `engine.ts:82-95` | ❌ **Non** (aucun `explainComplexite`, aucun breakdown) |
| Score **vigilance** | ✅ Calculé | `engine.ts:43-76` | ✅ Oui (`VigilanceBreakdown`) |
| Score **qualité de preuve** | ✅ Calculé (ratio) | `engine.ts:101-112` | ❌ **Non** |
| **Scores des dossiers FIXTURES** | ❌ **EN DUR** | voir §2 | — (et **incohérents** avec la décompo) |
| **Signaux des dossiers FIXTURES** | ❌ **EN DUR** | voir §2 | — |
| UBO recalculé (dilution indirecte) | ✅ Calculé | `ubo.ts:82-150` | partiel (`UboPanel`) |
| UBO divergent (déclaré vs recalculé) | ✅ Calculé | `ubo.ts:166-188` | partiel (mais signal fixture en dur) |
| Centralité (betweenness) | ✅ Calculé | `algorithms.ts:26-65` | ✅ /analyse (recalculé à la volée) |
| Boucles (cycles de détention) | ✅ Calculé | `algorithms.ts:54` (SCC ≥2) | ✅ /analyse |
| Plus court chemin → sanction | ✅ Calculé | `algorithms.ts:82-102` + règle `PROXIMITE_SANCTION` (BFS, score ↓ par sauts) | partiel |
| Matrice /secteurs | ⚪ Éditorial statique | `sector-threats.ts` | n/a (illustratif honnête) |
| ThreatMatrix landing | ⚪ Mockup en dur | `page.tsx` (`cells: [...]`) | n/a (vitrine honnête) |
| Scores /demo | ⚪ Scripté | `demo-data.ts` (`DEMO_SCORES`) | n/a (auto-play, simulation) |

## §1 — Les trois scores (moteur `engine.ts`)

- **Complexité** — CALCULÉ : `density*22 + log2(n+1)*8 + log2(maxDegree+1)*8`, clampé
  (`computeComplexite`, `engine.ts:82-95`). Dérivé du graphe ; constantes empiriques
  documentées. **Mais aucune décomposition** : pas de fonction `explainComplexite`,
  pas de composant breakdown. Affiché comme un nombre opaque (`ScorePills`).
- **Vigilance** — CALCULÉ + DÉCOMPOSABLE : `explainVigilance` (somme pondérée des
  signaux, poids par sévérité, `engine.ts:15-76`) ; rendu par `VigilanceBreakdown`
  dans l'onglet risques. ✅ Conforme au critère.
- **Qualité de preuve** — CALCULÉ : part de nœuds/arêtes/événements `confirmed|declared`
  (`computeQualitePreuve`, `engine.ts:101-112`). **Aucune décomposition** dans l'UI.

## §2 — Constat majeur : les dossiers FIXTURES hardcodent scores ET signaux

`getCase()` du `FixtureCasesRepository` renvoie le bundle **tel quel** — `computeRisk`
n'est **jamais** rejoué pour les dossiers de démonstration. Or chaque fixture définit
ses scores et signaux **en dur** :

| Fixture | `scores` en dur | `riskSignals` |
|---|---|---|
| `case-demo.ts:13` | `{58, 72, 64}` | en dur (`:224`) |
| `cases/reseau-multi-dirigeants.ts:9` | `{86, 64, 52}` | en dur (`:105`) |
| `cases/holding-ubo.ts:105` | `{62, 58, 71}` | en dur (`:110`) |
| `cases/clean-company.ts:9` | `{18, 12, 88}` | `[]` |
| `cases/procedure-collective.ts:9` | `{34, 81, 70}` | en dur (`:86`) |

**Conséquences :**
1. **En dur déguisé en calcul** : en mode démo (par défaut), tous les scores affichés
   sont écrits à la main, non dérivés du graphe.
2. **Incohérence en-tête ↔ décomposition** : `holding-ubo` affiche `vigilance = 58`
   dans l'en-tête, alors que `VigilanceBreakdown` recalcule `explainVigilance` à partir
   de l'unique signal du fixture → **≈ 38**. Le nombre affiché ne correspond pas à sa
   propre décomposition.
3. Les signaux des fixtures sont rédigés à la main (au lieu d'être produits par les
   règles sur le graphe) — donc non traçables au moteur.

Le chemin **live** (`assembleCase → computeRisk`, `assemble-case.ts`) calcule, lui,
réellement les scores et signaux. Seuls les **fixtures** sont en dur.

## §3 — UBO et algorithmes : DÉJÀ calculés (ne pas refaire)

- **Détention indirecte / dilution** : `computeUbo` (`ubo.ts:82-150`) remonte le
  sous-graphe `DETIENT`, **multiplie les % le long de chaque chemin**, **somme les
  chemins parallèles**, applique le seuil 25 % (`UBO_THRESHOLD`) **ou** contrôle
  majoritaire ≥ 50 %, cycle-safe. ✅ Déjà conforme à l'ÉTAPE 1.1.
- **Boucles** : `stronglyConnectedComponents` filtré ≥ 2 (`algorithms.ts:54`) + règle
  `CYCLE_DETENTION`. ✅ ÉTAPE 1.2 déjà couverte.
- **Plus court chemin → sanction** : `shortestEvidenceWeightedPath` (Dijkstra pondéré
  par niveau de preuve, `algorithms.ts:82-102`) + règle `PROXIMITE_SANCTION` (BFS,
  1 saut → high, 2 sauts → medium). ✅ ÉTAPE 1.3 déjà couverte.
- **Centralité** : betweenness normalisée (`algorithms.ts:33`), recalculée à la volée
  dans `/analyse`. ✅ ÉTAPE 1.4 déjà couverte.

## Périmètre EXACT de l'ÉTAPE 1 (défini par cet audit)

**À implémenter (ce qui est en dur / non décomposable) :**
1. **Recalculer scores + signaux des fixtures depuis le graphe** (`computeRisk` au
   chargement) → supprimer tout `scores`/`riskSignals` en dur. Corrige le §2.1 **et**
   l'incohérence §2.2.
2. **Décomposer complexité et qualité de preuve** : `explainComplexite`,
   `explainQualitePreuve` (composantes + poids) + breakdowns UI, et **rendre les trois
   `ScorePills` cliquables** vers leur décomposition. *Critère : un score non
   décomposable n'est pas affiché.*
3. **Tests pièges** (boucle, chemins parallèles, seuil exactement 25 %, chaîne profonde)
   pour le calcul d'UBO et de scores — compléter `ubo.spec.ts`.
4. Vérifier que chaque résultat algorithmique porte sa **limite** (ex. proximité
   sanctions → « un chemin de proximité n'établit pas une relation juridique »).

**À NE PAS refaire (déjà calculé)** : `computeUbo`, SCC, `shortestEvidenceWeightedPath`,
`PROXIMITE_SANCTION`, betweenness, `explainVigilance`.

**Hors périmètre (éditorial / scripté, honnêtement étiqueté)** : matrice `/secteurs`,
ThreatMatrix de la landing, scores scriptés `/demo`.
