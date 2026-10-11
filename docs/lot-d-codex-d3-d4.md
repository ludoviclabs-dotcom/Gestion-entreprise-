# Lot D — suite pour Codex : D3 (HATVP) puis D4 (DECP)

> Addendum à `docs/lot-d-brief-codex.md` (le brief d'origine reste la référence pour la
> doctrine, les conventions et la checklist « ajouter une source »). Ce document donne
> **l'état réel au 11 octobre 2026**, ce qui a changé depuis, et la spécification de D3 et
> D4 avec des faits **vérifiés ce jour**. D0, D1 et D2 sont livrés et validés en production.

## 0. Mission

Livrer **deux PR indépendantes, dans cet ordre**, chacune depuis `main` à jour :

1. **D3 — HATVP** : répertoire des représentants d'intérêts, niveau **organisation** seulement.
2. **D4 — DECP** : marchés publics (données essentielles), **fenêtre glissante de 12 mois**.

Ne pas commencer D4 avant que D3 soit fusionnée **et** activée par l'utilisateur.
Aucune autre source : DGAL-agréments et EITI restent **hors périmètre** (décision produit).

## 1. Prérequis — à vérifier avant d'écrire une ligne

```bash
git fetch origin && git log origin/main --oneline -15
ls drizzle | tail -5                                  # dernière migration : 0017 ou 0016
test -f scripts/import/run.ts && grep -n "ALL_SOURCES\|camino\|icpe" scripts/import/run.ts
test -f src/lib/connectors/camino.ts && test -f src/lib/connectors/icpe-import.ts
grep -n "isInformationalEvent" src/lib/graph/informational-events.ts
grep -rn "source non importée" src/lib/connectors/degraded.ts
```

| Élément | État | Où |
|---|---|---|
| Socle d'imports D0 (`open_data_imports`, workflow, flux, lots, verrou) | **fusionné** (#42) | `scripts/import/lib/*`, `.github/workflows/import-open-data.yml` |
| D1 Camino, D2 ICPE | **fusionnés et actifs en production** (#43, #45) | `scripts/import/camino.ts`, `icpe.ts`, `src/lib/connectors/camino.ts`, `icpe-import.ts` |
| Création de dossier : presse GDELT collectée après la réponse | **fusionné** (#47) | `assembleCase(siren, { deferPress })` |
| Registre des gels (DG Trésor) importé chaque jour | **PR #48 en revue** | `scripts/import/tresor-gels.ts`, migration **0017** |

**Numérotation** : D3 prend la migration **0018**, D4 la **0019** (la 0017 est celle de la PR
#48). Si #48 n'est pas fusionnée quand tu ouvres ta PR : rebase dessus et réécris
`scripts/import/run.ts` (tableau `ALL_SOURCES`), l'option `source` du workflow, `IMPORT_LABELS`
(`src/lib/data/import-freshness.ts`) et `docs/lot-d-activation.sql` **sans écraser** ses ajouts.

## 2. Ce qui s'est passé depuis le brief — leçons à appliquer

1. **Incident réel : création de dossier cassée en production (HTTP 500).** Les flags avaient
   été posés sans que les `ALTER TYPE … ADD VALUE` de l'enum `source_kind` soient appliqués.
   Toute nouvelle source (`hatvp`, `decp`) exige donc : la valeur dans
   `src/lib/graph/source.ts` **et** `src/lib/db/schema/enums.ts` (avant `"manual"`), une
   migration `ADD VALUE IF NOT EXISTS … BEFORE 'manual'` (instruction séparée), et dans la PR
   **la requête de contrôle** à faire exécuter par l'utilisateur après le SQL :
   ```sql
   select string_agg(e.enumlabel, ', ' order by e.enumsortorder)
   from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'source_kind';
   ```
   Ordre d'activation **non négociable** : SQL → vérification de l'enum → fusion → import →
   flag Production → redéploiement. Une fusion seule n'active rien.
2. **Durée de création** : un dossier se crée en ≈ 4 s (instance chaude) à ≈ 10 s (froide).
   Chaque source ajoutée doit lire **la base** en une requête (< 100 ms). Aucun appel réseau
   synchrone nouveau. Mesurer avec `cases.metadata.timings` (onglet Sources du dossier).
3. **Lecture en un seul snapshot SQL** (en-tête d'import + lignes), comme `camino.ts` : jamais
   « lire l'import_id puis ses lignes » en deux requêtes.
4. **Absent ≠ non importé ≠ en échec** : suffixe `(source non importée)` déjà reconnu par
   `src/lib/connectors/degraded.ts` ; ne pas en inventer d'autre sans l'ajouter à la regex
   **avec un test**. Un jeu non importé n'est jamais « aucune présence ».
5. **Aucun effet sur les scores** : pas de nouveau signal de vigilance, pas de changement de
   `SCORE_MODEL_VERSION`. Les événements informatifs passent par
   `src/lib/graph/informational-events.ts` (`isInformationalEvent`) : y ajouter le nouveau
   `kind` **avec un test de non-régression** (scores identiques avec et sans les événements).
6. **Pièges d'outillage vérifiés** : `vitest` ne prend que `*.spec.ts` ; ne pas écrire
   `beforeEach(() => mock.reset())` (la fonction retournée est appelée comme nettoyage) ;
   `tsx` n'accepte pas l'`await` de haut niveau (envelopper dans `main()`) mais résout bien
   l'alias `@/` ; fichiers en CRLF dans l'arbre de travail ; `npm ci --legacy-peer-deps`.
7. **Validation de production par Claude** après activation : attributs à libellé **stable**,
   détail dans l'onglet Sources du dossier. Ne pas créer plus de dossiers de test que
   nécessaire (la liste de l'utilisateur en compte déjà une vingtaine).
8. **Secrets** : `DATABASE_URL_UNPOOLED` est déjà posé dans GitHub. Ne jamais demander à
   l'utilisateur de coller un secret dans la conversation ; ne jamais en journaliser.

## 3. D3 — HATVP (organisations)

### 3.1 Faits vérifiés le 11 octobre 2026

- Fichier : `https://www.hatvp.fr/agora/opendata/agora_repertoire_opendata.json`
  (≈ 138 Mo, JSON `{"publications":[ … ]}`, mis à jour **quotidiennement**).
- Une publication = une organisation. Clés observées :
  `typeIdentifiantNational` (`SIREN`, `RNA`, `HATVP`…), `identifiantNational`,
  `denomination`, `nomUsage`, `categorieOrganisation{code,label,categorie,notifSansChiffreAffaire}`,
  `ville`, `pays`, `codePostal`, `lienSiteWeb`, `isActivitesPubliees`,
  `datePremierePublication` et `dateCreation` au format **`JJ/MM/AAAA HH:MM:SS`**,
  `exercices[].publicationCourante{dateDebut, dateFin, nombreActivite, noActivite,
  dispenseDeclaration, defautDeclaration}` (dates `JJ-MM-AAAA`), `affiliations[]`, `clients[]`,
  `activites{listSecteursActivites, listNiveauIntervention}`.
- ⚠️ **Le même objet contient des données personnelles** : `dirigeants[]` et
  `collaborateurs[]` (civilité, nom, prénom, fonction), `telephoneDeContact`,
  `emailDeContact`, `adresse`, comptes sociaux.
- Les index de dossiers renvoient 403 : ne pas chercher d'autres CSV. **Utiliser le JSON.**
- **Vérifier toi-même sur un échantillon étendu** (≥ 5 000 organisations) : proportion de
  `typeIdentifiantNational = SIREN`, présence d'`exercices` vides, valeurs de
  `categorieOrganisation.categorie`, organisations radiées/désinscrites (clé à identifier :
  le CSV historique portait `dateCessation` et `motifDesinscription` — confirmer l'équivalent
  JSON ou documenter son absence).

### 3.2 Projection (liste blanche stricte)

Une ligne par organisation **ayant un SIREN valide** (9 chiffres, Luhn, hors `000000000`) :

| Colonne | Source | Remarque |
|---|---|---|
| `siren` | `identifiantNational` si `typeIdentifiantNational = 'SIREN'` | clé de rapprochement |
| `denomination` | `denomination` | nom d'organisation, pas de personne |
| `category_code`, `category_label`, `category_group` | `categorieOrganisation.*` | |
| `first_published_on` | `datePremierePublication` | converti en date ISO |
| `activities_published` | `isActivitesPubliees` | booléen, **inconnu ≠ faux** (nullable) |
| `last_exercise_end` | max des `exercices[].publicationCourante.dateFin` | date ISO |
| `activity_count_last` | `nombreActivite` du dernier exercice | entier nullable |
| `no_activity_declared` | `noActivite` du dernier exercice | nullable |
| `website` | `lienSiteWeb` | **seulement** si organisation morale ; borné à 500 car. |

**Interdit en base, en fixture, en test et à l'écran** : `dirigeants`, `collaborateurs`,
`adresse`, `telephone*`, `email*`, comptes sociaux, `clients`, `affiliations`, `activites`
détaillées, noms de personnes. Test obligatoire : un JSON d'entrée volontairement piégé
(dirigeant, courriel, téléphone) → **aucune** de ces valeurs dans les lignes projetées.
Les entrepreneurs individuels sont **conservés** (décision produit) : SIREN et informations
professionnelles uniquement.

### 3.3 Table, import, lecture

- Table `hatvp_organisations` : `import_id` (FK `open_data_imports(id)` **ON DELETE
  CASCADE**), clé primaire `(import_id, siren)`, index `(siren, import_id)`. Dédoublonner par
  SIREN (garder la publication la plus récente) avec `ON CONFLICT`.
- Source `hatvp`, version de projection `hatvp-v1`. Fichier 138 Mo : **flux JSON**
  (aucune bibliothèque de flux JSON n'est présente — seulement `csv-parse` : ajouter
  `stream-json` ou équivalent, le justifier dans la PR, vérifier `npm ci --legacy-peer-deps`), plafond d'octets via `Fingerprint`, **jamais** le fichier entier en mémoire.
  Seuil de sanité : au moins 5 000 organisations ; refuser un schéma non reconnu.
- Cadence : le fichier change chaque jour mais l'information (inscription, catégorie) évolue
  lentement → **mensuel** suffit (workflow `all` existant). Afficher la date d'import.
- Connecteur `src/lib/connectors/hatvp.ts` : flag `HATVP_ENABLED`, mode démo → fixture ;
  une seule requête SQL (snapshot) ; `(source non importée)` si aucun import validé.
- Normaliseur et rendu : attribut **« Répertoire HATVP »**, par exemple
  « Inscrite au répertoire HATVP depuis 2025 — catégorie : Société commerciale et civile —
  exercice clos le 31/12/2025 : 0 activité déclarée — jeu importé le 2026-10-12 ».
  **Formulation neutre** : l'inscription est une **obligation légale de transparence**, pas un
  indice de risque. Une entreprise **absente** du répertoire n'est pas « suspecte » : dire
  « non inscrite dans le jeu importé » seulement si un import validé existe.
  Aucun événement, aucun lien, aucune règle. Ne jamais relier une organisation à un élu ou à
  un décideur.

### 3.4 Tests et vérification réelle

Mêmes familles que D1/D2 (`src/tests/unit/camino-import.spec.ts`, `icpe-import.spec.ts`,
`icpe-national.spec.ts` comme modèles) : projection, minimisation, dates `JJ/MM/AAAA`,
SIREN invalides, doublons, fichier tronqué, flux interrompu sans empreinte, upsert, lecture
SQL (absent / non importé / erreur), rendu neutre, **aucun champ personnel**.
Vérification réelle : télécharger le vrai fichier en flux, donner dans la PR : nombre
d'organisations, part avec SIREN, durée, pic mémoire, SHA-256, et un tableau
EDF / LIDL / LA POSTE / HSBC / un témoin absent (présence ou non au répertoire).

## 4. D4 — DECP (marchés publics)

### 4.1 Faits vérifiés le 11 octobre 2026

- Jeu data.gouv.fr `donnees-essentielles-de-la-commande-publique-fichiers-consolides` :
  42 ressources ; mensuels `decp-AAAA-MM.json` (liste via l'API
  `/api/1/datasets/<slug>/`, champs `title`, `url`, `filesize`, `last_modified`).
- **Poids des 12 derniers mensuels : ≈ 1 243 Mo de JSON** (47 / 144 / 135 / 142 / 141 / 69 /
  76 / 93 / 73 / 92 / 150 / 81 Mo, d'octobre 2026 à novembre 2025). Les fichiers sont
  régénérés (dates de modification récentes) : un mensuel peut changer après sa publication.
- Schéma d'un marché : voir brief §5.4. **Clé naturelle = (`acheteur.id`, `id`, `codeCPV`
  normalisé)** — la paire (`acheteur.id`, `id`) fusionnait à tort des contrats distincts.
  Le titulaire n'a **pas de dénomination** (type d'identifiant + identifiant seulement) ;
  l'acheteur non plus (SIRET).

### 4.2 Décisions produit déjà prises

- **Fenêtre initiale : 12 mois glissants**, à **mesurer avant activation** (voir 4.4).
- Entrepreneurs individuels **conservés** (SIREN/SIRET, informations professionnelles) ;
  aucun contact privé. Les marchés dont le titulaire est une personne physique sans SIREN
  exploitable ne sont pas rapprochables : les compter, ne pas les inventer.
- **Attributs + événements datés plafonnés (20)**, comme Camino, **sans effet sur les
  scores ni les signaux** (kind `marche_public_attribue`, **distinct** de
  `marche_public_resultat` du BOAMP, déclaré informatif — voir §2 point 5).
- Libellé : « marché notifié à … (titulaire déclaré dans les DECP) » — toujours sans
  jugement ; un marché attribué n'est ni un indice de risque ni une relation d'influence.

### 4.3 Projection et qualité

Colonnes (liste blanche, **sans `objet`** ni texte libre volumineux) : clé naturelle, SIRET
et SIREN du titulaire, SIREN de l'acheteur (`substr(acheteur.id,1,9)`), `codeCPV` normalisé,
`nature`, `procedure`, `dateNotification`, `montant` (nullable), indicateur
`amount_unreliable`, `source` (champ `source` du marché), mois du fichier d'origine.

- Normaliser `codeCPV` (moins de 8 caractères → complété par des `0` ; plus de 8 →
  raccourci ; sans chiffre de contrôle) — règle du projet de consolidation (notes v2.9.1).
- Dédoublonner **entre fichiers** (même clé naturelle) en gardant la version la plus récente
  (`datePublicationDonnees`) ; gérer `modifications` si présentes (**à vérifier** sur un
  échantillon : présence, forme, `typeIdentifiant` autre que `SIRET`, accords-cadres sans
  titulaire).
- Montants : `0`, négatifs, ≥ 999 999 999 ou non numériques → conserver la ligne, marquer
  `amount_unreliable = true`, **exclure du cumul** et le dire dans le rendu.
- SIRET du titulaire invalide (Luhn / 14 chiffres) → compté dans les statistiques, non
  rapproché.

### 4.4 Volume, stockage, durée — à mesurer AVANT toute activation

L'abonnement Neon n'est pas modifié et son quota réel n'est pas confirmé. Dans la PR :
1. nombre de marchés et de lignes titulaire sur les 12 mois, taille moyenne d'une ligne,
   **estimation du stockage** (`pg_total_relation_size` sur un jeu de test) ;
2. durée réelle du téléchargement en flux et du chargement, pic mémoire ;
3. **plan B** si l'estimation est trop lourde : table agrégée par SIREN (nombre de marchés,
   cumul fiable, dernière notification, 5 principaux acheteurs) **plus** les 20 marchés les
   plus récents par SIREN, calculés à l'import. La lecture reste une requête SQL.
Demander à l'utilisateur **le stockage disponible dans son plan Neon** (nombre, sans
capture ni secret) avant de choisir entre le plan nominal et le plan B.
Limites à poser et tester : 25 min par ressource, plafonds d'octets par fichier, nombre de
fichiers, refus d'un fichier vide ou tronqué ; un fichier mensuel en échec **annule tout
l'import** (la fenêtre précédente reste servie).

### 4.5 Table, import, lecture, rendu

- Source `decp`, version `decp-v1`, flag `DECP_ENABLED`, table(s) avec FK `import_id`
  **ON DELETE CASCADE**, index `(titulaire_siren, import_id)` et
  `(acheteur_siren, import_id)`.
- Rapprochement : `titulaires[].id` → SIREN = `substr(id,1,9)`, **et** côté acheteur (une
  collectivité ou un établissement public peut être le sujet du dossier).
- Attributs stables : **« Marchés publics attribués (DECP) »** — nombre de marchés notifiés
  sur la fenêtre, montant cumulé **déclaré** (hors montants non fiables, dit), dernière
  notification, principaux acheteurs identifiés par SIRET (ne pas inventer de nom), fenêtre
  et date d'import ; et **« Commande publique (acheteur, DECP) »** pour un acheteur.
- Événements : jusqu'à 20 (`marche_public_attribue`), titre neutre, date de notification,
  niveau de preuve `declared`, source `decp` référencée.
- Un jeu non importé : consultation dégradée `(source non importée)`, jamais « aucun
  marché ». Un import validé sans ligne pour le SIREN : « aucun marché notifié sur la
  fenêtre importée » **avec la fenêtre et la date**, jamais une affirmation générale.

## 5. Ce que l'utilisateur fera (à lui demander une seule fois, étapes numérotées)

Pour chaque PR : (1) coller le SQL de la migration dans Neon (SQL Editor) puis la requête de
contrôle de l'enum ; (2) fusionner ; (3) Actions → Import open data → Run workflow → `main` →
source (`hatvp` / `decp`), relancer pour constater « inchangé » ; (4) Vercel Production :
`HATVP_ENABLED=true` / `DECP_ENABLED=true`, redéployer ; (5) écrire « D3 activé » / « D4 activé »
à Claude, qui valide en production et rapporte. Le secret GitHub est déjà en place. La
variable GitHub `OPEN_DATA_IMPORTS_ENABLED` pilote les rendez-vous automatiques.

## 6. Critères d'acceptation (par PR)

- [ ] Prérequis §1 vérifiés ; migration idempotente, sans BOM, numérotée 0018 / 0019 ; enum
      `source_kind` mis à jour **aux quatre endroits** (types, schéma, SQL, libellés).
- [ ] Import reproductible, idempotent (« inchangé » à fichier identique), atomique ; mémoire
      bornée ; durée < 30 min par source dans Actions.
- [ ] Connecteur : une requête SQL, absent / non importé / en échec distingués, ne lève jamais.
- [ ] **Aucune donnée personnelle de personne physique** en base ni à l'écran (test).
- [ ] Aucun effet sur les scores ni les signaux (test de non-régression des scores).
- [ ] Création de dossier : surcoût < 100 ms par source (mesuré, dans la PR).
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npx eslint src scripts` verts.
- [ ] Vérifié sur les **vraies** sources (tableau dans la PR, scripts jetables supprimés).
- [ ] `.env.example`, `docs/lot-d-imports.md`, `docs/lot-d-activation.sql`, page Réglages
      (fraîcheur de l'import) mis à jour.
- [ ] Description de PR : **SQL exact à coller**, ordre d'activation, limites connues.
