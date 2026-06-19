# Couche transactionnelle (Lot D) & adverse media (Lot C)

> Deux couches d'analyse ajoutées à la suite du tri du plan d'acquisition. Toutes
> deux **compute-first** (la donnée vient de la source ; aucune inférence LLM),
> **non accusatoires** (signaux ≠ conclusions, décision humaine), et **faisceau**
> (jamais d'alerte sur un signal isolé).

## 1. Détecteurs transactionnels — `src/lib/risk/transactional/`

⚠️ **Périmètre flux RÉOUVERT** : revient sur la décision « pas de moteur de flux,
VIGIL-AML hors périmètre ». Les détecteurs opèrent sur des transactions
**importées (client)** ou des **jeux synthétiques documentés** — jamais une
donnée d'échantillon présentée comme réelle. **Aucune arête `flux` n'est
introduite dans le graphe à ce stade** (décision différée).

| Détecteur | Fichier | Principe | Limite assumée |
|---|---|---|---|
| **Benford** | `benford.ts` | χ² du premier chiffre vs `log10(1+1/d)` | n ≥ ~50 ; données multi-échelles seulement ; déviation ≠ preuve |
| **Doublons** | `duplicates.ts` | même montant + contrepartie, ≥ 2 occurrences | un loyer mensuel identique est légitime |
| **Montants aberrants** | `outliers.ts` | écart absolu médian (MAD, Iglewicz–Hoaglin), **déterministe** | choisi vs isolation forest (stochastique) pour une preuve reproductible |

Agrégat : `analyzeTransactions(txns)` → `{ count, benford, duplicates, outliers }`.
**Différé** : anneaux de fraude (nécessitent une représentation de flux) et
UN Comtrade (TBML).

## 2. Adverse media (GDELT) — `connectors/gdelt.ts` + `ingestion/normalize-gdelt.ts`

Interroge la presse mondiale par nom d'entité (API GDELT DOC 2.0, ouverte, sans
clé). Les articles sont **appariés aux entités du graphe** par le moteur de
résolution d'entité (tous les tokens significatifs du nom présents dans le
titre), puis émis en **événements « couverture médiatique »** (`evidenceLevel:
inferred`) dans la timeline. Une tonalité négative (`tone ≤ -3`, si fournie) les
marque *défavorables*.

- **Surfaçage, pas alerte** : les événements sont présentés pour examen humain.
  La **règle de faisceau dédiée** (compter les couvertures défavorables par
  entité) est **différée** — pour éviter d'étiqueter une entité réelle sur la
  seule présence presse, et de perturber les signaux de la démo.
- **Garde-fou live** : comme tous les connecteurs, gaté par `usableResult` — en
  mode live, un connecteur désactivé (fixture) n'enrichit jamais un dossier réel.

## Activation

Les deux couches suivent le pattern env-driven : `GDELT_ENABLED=true` pour la
presse (cf. `docs/tutorial-connecteurs.md`). Les détecteurs transactionnels sont
une bibliothèque pure (pas de connecteur) : ils s'appliquent à un jeu de
transactions fourni en entrée.
