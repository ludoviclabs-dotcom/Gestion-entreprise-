# Lot D — jeux de données volumineux (import) — dossier de passation pour Codex

> Document autonome : tout ce qu'il faut pour réaliser le lot D sans le contexte de la
> conversation d'origine. Les faits ci-dessous ont été **vérifiés sur les vraies sources le
> 2026-10-10** (statuts HTTP, tailles, en-têtes). Ce qui n'a PAS été vérifié est marqué
> **⚠️ À VÉRIFIER**.

## 0. Mission en une phrase

Faire entrer dans KYB Graph les sources ouvertes **trop volumineuses pour être interrogées en
direct** à chaque création de dossier (fichiers de 7 Mo à 1 Go, ou API sans filtre par SIREN),
en les **important périodiquement dans Neon**, puis en les exposant par des connecteurs
rapides qui lisent la base.

Lots déjà livrés (à reprendre comme modèles) : **A** BALO/BOAMP/DCA/JOAFE, **B**
RGE/Agence BIO/Alim'confiance/Qualiopi, **C** Géorisques/Annuaire (PR en cours) — tous des
connecteurs « appel direct ». Le lot D est le premier à nécessiter une **infrastructure
d'import**.

## 0 bis. Prérequis — à vérifier AVANT d'écrire la moindre ligne

Ce dossier s'appuie sur du code qui vit dans des PR **qui doivent être fusionnées dans
`main` d'abord**. Partir d'un `main` qui ne les contient pas rend plusieurs consignes
inapplicables (fichiers « modèles » absents, suffixe de dégradation inconnu).

| PR | Contenu dont dépend le lot D | Vérification (doit réussir sur `main`) |
|---|---|---|
| **#39** perf 2 | suffixe `(délai dépassé)` dans `degraded.ts` ; durées par source (`timings`) ; seconds sauts enchaînés dans `assemble-case.ts` | `grep -n "délai dépassé" src/lib/connectors/degraded.ts` |
| **#40** lot C | `georisques.ts`, `annuaire-administration.ts`, `normalize-regulatory.ts`, `assemble-regulatory.spec.ts`, `sirene.listOpenEtablissements`, migration `0013` | `ls src/lib/connectors/georisques.ts src/lib/ingestion/normalize-regulatory.ts` |
| **#41** ce dossier | `docs/lot-d-brief-codex.md` | — |

Si l'une de ces vérifications échoue, **s'arrêter et le signaler** : ne pas recréer ces
éléments dans la PR du lot D (conflits garantis avec #39/#40). Les numéros de migration du
lot D se placent **après la plus récente de `drizzle/`** (aujourd'hui `0013`, à relire).

## 1. Le produit, en 60 secondes

- **KYB Graph** : cartographie de conformité d'une société à partir de son SIREN. Stack :
  Next.js 16 (App Router) + TypeScript, Drizzle + Neon Postgres (driver `neon-http`),
  déployé sur Vercel. Dépôt : `ludoviclabs-dotcom/Gestion-entreprise-`.
- **Pipeline** : `src/lib/ingestion/assemble-case.ts` → `assembleCase(siren)` appelle les
  connecteurs (en parallèle), normalise, construit un `CaseBundle` (entités, liens, événements,
  signaux de risque), puis `DbCasesRepository.createCaseFromSiren` persiste tout en une
  transaction (`db.batch`).
- **Modes** : démo (fixtures, par défaut) / live. Chaque connecteur est **opt-in** par un flag
  `*_ENABLED` (défaut `false`), et **inerte** hors mode live.
- **Utilisateur** : novice, il ne fait que : coller du SQL dans l'éditeur SQL de Neon, poser
  des variables dans Vercel, fusionner les PR. **Il n'exécutera aucun script en local.**
  Conséquence directe : l'import doit tourner **sans lui** (GitHub Actions ou cron), et ses
  étapes manuelles doivent tenir en « colle ce SQL / pose cette variable / ajoute ce secret
  GitHub ».

## 2. Doctrine (non négociable — tout le produit y est aligné)

1. **Non accusatoire.** Jamais « fraude », « suspect »… Une publication n'est pas une
   relation (BOAMP : « mentionnant l'entreprise »). Un label, une certification, une
   installation classée, un marché attribué sont des **informations**, pas des alertes.
2. **Absence ≠ panne ≠ non interrogé.** Trois états distincts, toujours : (a) « interrogé, rien
   trouvé » (absence avérée), (b) « consultation en échec » (dégradée), (c) « non interrogé /
   non importé ». Ne jamais afficher « aucun » dans les cas (b) et (c). Convention de
   dégradation : suffixe d'`endpoint` — voir `src/lib/connectors/degraded.ts`
   (`isDegradedEndpoint`, une regex). Sur `main` **avant** la PR #39 elle ne reconnaît que
   `(exception)`, `(erreur N)` et `(schéma non reconnu)` ; la PR #39 ajoute
   `(délai dépassé)` (**prérequis**, voir §0 bis). **Le lot D doit ajouter un suffixe
   pour « source non importée » — p. ex. `(source non importée)` — dans cette même regex,
   avec un test** : un connecteur qui produirait un suffixe absent de la regex serait lu
   comme une consultation RÉUSSIE (donc comme une absence avérée) par `openDataUsable` et
   `getSourceHealth`. Tout nouveau suffixe = regex + test dans `degraded`/`case-quality`.
3. **Minimisation des données personnelles (RGPD / CJUE 2022).** Ne **jamais** stocker ni
   afficher : noms de personnes physiques, dates de naissance, adresses de personnes,
   téléphones, courriels. Les sources contiennent beaucoup de ces champs (HATVP : dirigeants,
   collaborateurs ; Annuaire : agents) — **ne pas les sélectionner**.
   Entrepreneurs individuels (catégorie juridique `1000`) : leur SIREN est lié à une
   personne physique → **à exclure de l'affichage nominatif ou à traiter en agrégat**
   (décision à faire valider par le produit ; défaut recommandé : exclusion).
4. **Aucun effet silencieux sur le risque.** Par défaut un nouveau connecteur produit des
   **attributs** (texte de synthèse sur la société) ou des **événements** de `kind` dédié —
   jamais de signal de vigilance ni de changement de score sans décision explicite. Les
   événements sont des nœuds du graphe : n'en émettre que pour des faits **datés** et
   plafonner leur nombre (voir lots A).
5. **Secrets.** Jamais de clé, mot de passe ou URL de base de données dans le code, les
   logs, les PR, les messages. Le mot de passe Neon local (`.env.local`) est périmé : **ne pas
   s'en servir**.

## 3. Conventions du dépôt (à suivre mot pour mot)

Lire d'abord : `AGENTS.md` (⚠️ ce Next.js n'est pas celui que vous connaissez — lire
`node_modules/next/dist/docs/` avant d'écrire du code Next), `docs/architecture.md`,
`docs/tutorial-connecteurs.md`, et comme **modèles** : `src/lib/connectors/balo.ts`,
`opendatasoft.ts`, `src/lib/ingestion/normalize-dila.ts`, `normalize-labels.ts` (présents
sur `main`) ; **après fusion de la PR #40** : `src/lib/connectors/georisques.ts`
(plusieurs requêtes + garde « filtre ignoré »), `src/lib/ingestion/normalize-regulatory.ts`
(couverture dite).

### 3.1 Checklist « ajouter une source » (toutes les étapes sont obligatoires)

1. `src/lib/graph/source.ts` — ajouter la valeur à `SourceKind`.
2. `src/lib/db/schema/enums.ts` — l'ajouter à l'enum `source_kind` (**avant** `"manual"`).
3. `src/components/cases/source-labels.ts` — libellé français.
4. `src/lib/env.ts` — flag `X_ENABLED` (`z.enum(["true","false"]).default("false")`), fonction
   `isXEnabled()`, éventuelles URL de base ; `.env.example` documenté.
5. `src/lib/connectors/status.ts` — entrée (page Réglages) ; mettre à jour
   `src/tests/unit/connector-status.spec.ts` (liste exhaustive des clés).
6. Le connecteur : `src/lib/connectors/<x>.ts`, signature
   `bySiren(siren): Promise<ConnectorResult<unknown>>` ; en démo/désactivé renvoie une
   fixture (`isFixture: true`, `httpStatus: 0`) ; **ne lève jamais**.
7. Normaliseur : `src/lib/ingestion/normalize-<x>.ts`, fonctions pures et défensives.
8. Branchement dans `assemble-case.ts` : n'appeler qu'en `live && isXEnabled()` ; pousser la
   ligne `sources` seulement si la source a été interrogée (jamais de ligne « inventée ») ;
   n'exploiter un résultat que s'il est réel (`openDataUsable` : 2xx, non fixture, non
   dégradé).
9. `src/lib/data/case-quality.ts` — ne rien casser (`getSourceHealth` compte les
   consultations dégradées comme échecs).
10. Migration : voir 3.2.
11. Tests (voir 3.3) et vérification sur les **vraies** sources (voir 3.4).

### 3.2 Migrations (piège majeur)

- Générer avec `npx drizzle-kit generate` (n'a pas besoin de la base).
- **Réécrire le SQL en version idempotente** : `ALTER TYPE … ADD VALUE IF NOT EXISTS`,
  `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. Un test
  (`migrations-hygiene.spec.ts`) impose `IF NOT EXISTS` sur les `ADD VALUE` et **interdit le
  BOM UTF-8**. Écrire le fichier avec un outil qui n'ajoute pas de BOM (pas
  `Set-Content -Encoding utf8` de PowerShell).
- **Ne jamais lancer `db:migrate`** : l'utilisateur colle le SQL dans l'éditeur SQL de Neon.
  Chaque PR doit donc contenir, dans sa description, **le SQL exact à coller**, dans l'ordre
  d'activation : SQL → fusion → variables Vercel → redéploiement. Si les variables sont
  posées avant le SQL, la création d'un dossier échoue (erreur contenant `enum`).
- Une valeur d'enum ajoutée ne peut pas être utilisée dans la même transaction que son
  `ADD VALUE` : instructions séparées (`--> statement-breakpoint`).

### 3.3 Tests attendus pour chaque source

Unitaires (Vitest, `npx vitest run`) : connecteur (URL/filtre exacts, absence avérée, 5xx,
non-JSON, panne réseau, garde « filtre ignoré », injection, minimisation des données
personnelles), normaliseur (jamais de levée, aucun jugement : pas de `fraude|sanction|infraction`),
assemblage (gating, panne d'une source, mode démo → aucun appel). Les modèles à copier :
`dila-connectors.spec.ts`, `labels-connectors.spec.ts`, `assemble-labels.spec.ts`,
`assemble-regulatory.spec.ts` (ce dernier : après fusion de #40). Avant tout commit : `npx vitest run`, `npx tsc --noEmit`,
`npx eslint src` doivent être verts.

### 3.4 Vérifier sur les vraies sources (obligatoire, déjà décisif plusieurs fois)

Les fixtures et les mocks ont plusieurs fois masqué des défauts réels. Faire un **test de
fumée jetable** (script temporaire, non commité, supprimé ensuite) qui appelle le vrai
connecteur sur 3–4 SIREN connus : EDF `552081317`, LIDL `343262622`, LA POSTE `356000000`,
HSBC Continental Europe `775670284`, une PME/association inconnue. `npx tsx` est disponible
(`npx --no-install tsx script.ts`).

### 3.5 Pièges d'outillage rencontrés

- Fichiers en **CRLF** dans l'arbre de travail Windows (`core.autocrlf=true`) : un remplacement
  de bloc multi-lignes peut échouer silencieusement ; normaliser `\r\n` avant de chercher.
- Heredocs bash contenant des apostrophes françaises : parfois mal interprétés — préférer
  écrire un fichier avec l'outil d'écriture.
- Arguments commençant par `/` sous Git Bash sont réécrits en chemins Windows
  (`MSYS_NO_PATHCONV=1`).
- Un test e2e d'un jeu (Fraud Detective) a déjà été rendu non-flaky ; ne pas y toucher.
- **Une seule PR par sujet, créée depuis `main`**, jamais empilée sur une autre branche
  (une PR empilée a déjà été fusionnée dans une branche morte).
- Toute PR reçoit un relecteur automatique (bot) dont les remarques ont toujours été
  fondées : les traiter, avec test.

## 4. Infrastructure d'import à construire (une fois, pour tous les jeux)

### 4.1 Pourquoi
Vercel (serverless, 300 s max, mémoire limitée) ne peut ni télécharger ni analyser un fichier
de 1 Go à chaque dossier, et il ne faut pas faire dépendre la création d'un dossier (≈ 8 à 11 s
de bout en bout après la PR #39, contre 22 s avant) d'un gros fichier. Donc : **import hors ligne → tables Neon
indexées par SIREN → connecteur qui lit la base (≈ 50 ms)**.

### 4.2 Où exécuter l'import (recommandation)
**GitHub Actions** (workflow `.github/workflows/import-open-data.yml`) :
- déclenchement `workflow_dispatch` (manuel, avec choix de la source) + `schedule` mensuel ;
- un script par source `scripts/import/<source>.ts` (exécuté par `npx tsx`), qui **télécharge
  en flux**, **analyse en flux** (ne jamais charger 1 Go en mémoire), et **upserte par lots**
  dans Neon ;
- une variable d'environnement `DATABASE_URL_UNPOOLED` fournie par **un secret GitHub** que
  l'utilisateur ajoute une fois (« Settings → Secrets → Actions »). Le workflow ne doit
  jamais l'afficher ;
- limites utiles : 6 h par job, ~7 Go de RAM, disque ~14 Go.
Alternative écartée : route cron Vercel (limite de durée), exécution locale (l'utilisateur ne
peut pas).

### 4.3 Modèle de données (à affiner par Codex, avec migration idempotente)

- **`open_data_imports`** : une ligne par import réussi — `source` (texte), `version`
  (ex. `decp-2026-10`), `source_url`, `sha256`, `record_count`, `imported_at`, `status`.
  Sert à (a) afficher la fraîcheur, (b) distinguer **« non importé » de « absent »**.
- Une table **par jeu**, clé de rapprochement **SIREN** (et SIRET si disponible), index sur le
  SIREN : `decp_marches`, `camino_titres`, `hatvp_organisations`, `icpe_sites`.
- **Import atomique** : écrire dans la table, puis marquer l'import `ok` ; un import
  interrompu ne doit jamais laisser une base partielle présentée comme complète (table de
  staging + échange, ou `import_id` + filtre sur le dernier import `ok`).
- **Idempotent** : relancer le même import ne duplique rien (clés naturelles + `ON CONFLICT`).
- Tailles à prévoir pour le plan gratuit Neon (≈ 0,5 Go de stockage — **à vérifier avec
  l'utilisateur**) : DECP en entier dépasserait probablement ce quota → ne conserver que les
  champs utiles, ou une fenêtre glissante (ex. 24 derniers mois), ou ne stocker que les
  marchés dont le titulaire a un SIREN valide.

### 4.4 Lecture côté application
Un connecteur par source, `bySiren(siren)`, qui lit la table via Drizzle et renvoie un
`ConnectorResult` :
- `endpoint` = `db:<table>?siren=…`, `httpStatus` 200, `isFixture` false ;
- **si aucun import `ok`** pour la source → consultation **dégradée** `(source non importée)`
  (jamais « aucun résultat ») ;
- réponse plafonnée (total réel + N derniers éléments), comme `BaloRaw`.
- Afficher la **fraîcheur** (« données du 2026-10-04 ») dans le libellé de l'attribut.

## 5. Les sources — faits vérifiés et décisions de conception

### 5.1 ICPE nationales (continuité directe du lot C) — priorité 1
- **Constat du lot C** : l'API `https://www.georisques.gouv.fr/api/v1/installations_classees`
  n'accepte que **`siret` exact** (14 chiffres) ; `siren=` est **ignoré et renvoie tout le
  fichier** ; un préfixe → HTTP 500 ; pas de recherche par nom. D'où la couverture partielle
  du lot C pour les groupes multi-sites.
- **Import** : paginer l'API sans filtre — `…/installations_classees?page=N&page_size=1000`
  → **138 777 lignes, 139 pages**, ≈ 1,4 Ko/ligne (≈ 190 Mo de JSON), 0,6–0,9 s par page.
  Réponse : `{ results, page, total_pages, data[], next }`.
- **Champs utiles** (par ligne = un site) : `siret`, `raisonSociale`, `commune`,
  `codeNaf`, `regime` (`Autorisation`, `Enregistrement`, `Autres régimes`, **`Non ICPE`** =
  référencé mais non classé → à exclure), `statutSeveso` (`Non Seveso`, `Seveso seuil bas`,
  `Seveso seuil haut`, ou null), `ied` (bool), `prioriteNationale` (bool), `etatActivite`
  (`En exploitation avec titre`, `En exploitation sans titre`, `En fin d'exploitation`, null),
  `inspections[].dateInspection`. **Ne pas** stocker `rubriques`, `documentsHorsInspection`,
  ni les rapports d'inspection (volumineux, interprétation juridique).
- **Rapprochement** : `substr(siret,1,9)` = SIREN → **couverture exhaustive** d'un groupe
  multi-sites. Remplace la limitation du lot C (le connecteur « direct » devient un repli
  quand l'import n'a pas eu lieu).
- **Rendu** : même attribut « Installations classées (Géorisques) » que le lot C
  (`normalize-regulatory.ts` → `icpeSummary`), la ligne de couverture partielle disparaît.

### 5.2 Camino — titres miniers — priorité 2 (le plus simple)
- **URL qui fonctionne** : `https://camino.beta.gouv.fr/apiUrl/titres?format=csv`
  (équivalent : `https://api.camino.beta.gouv.fr/titres?format=geojson`).
  ⚠️ `format=json` renvoie **HTTP 400** : formats acceptés `geojson | csv | xlsx | ods`.
- **Poids** : CSV ≈ **7 Mo**, **6 163 titres** (3 004 avec un SIREN exploitable).
- **En-tête CSV** : `id, nom, date_debut, date_fin, type, domaine, statut, substances,
  surface renseignee km2, communes (surface calculee km2), forets, facades_maritimes,
  departements, regions, administrations_noms, titulaires_noms, titulaires_adresses,
  titulaires_legal, titulaires_categorie, amodiataires_noms, amodiataires_adresses,
  amodiataires_legal, amodiataires_categorie, geojson, reference_*`.
- **Clé** : `titulaires_legal` = **SIREN** (plusieurs séparés par `;` ; vérifier le format,
  9 chiffres dans les lignes examinées) ; `amodiataires_legal` idem. Dates au format
  `JJ-MM-AAAA`. Champs multi-lignes entre guillemets (parseur CSV robuste obligatoire).
- **Statuts observés** : `valide` (438), `échu` (4 878), `demande initiale` (102),
  `demande classée` (717), `valide - survie provisoire`, `valide - modification en instance`.
- **À stocker** : id, nom, type, domaine, statut, substances, dates, SIREN titulaire(s) /
  amodiataire(s), départements. **Pas** le champ `geojson` (volumineux), pas `titulaires_adresses`.
- **Rendu** : attribut « Titres miniers (Camino) » : nombre de titres par statut/domaine,
  titres valides (échéance la plus lointaine). Événements possibles : octroi/échéance datés
  (plafonnés) — décision à valider. Une demande classée ou un titre échu n'est **pas** un
  manquement : le dire.

### 5.3 HATVP — répertoire des représentants d'intérêts — priorité 3
> ⚠️ **Corrigé et complété par `docs/lot-d-codex-d3-d4.md` (§3), qui prévaut** : le
> fichier compte 4 098 organisations ; aucune dénomination n'est conservée (76 sont des noms
> de personnes).

- **Fichiers** : JSON global `https://www.hatvp.fr/agora/opendata/agora_repertoire_opendata.json`
  (**138,7 Mo**, mis à jour **quotidiennement** ; top-level `{"publications":[…]}`) et CSV
  `https://www.hatvp.fr/agora/opendata/csv/Vues_Separees/1_informations_generales.csv`
  (1,2 Mo, séparateur `;`, champs multilignes entre guillemets). Les index de dossiers
  (`…/opendata/`, `…/csv/`) répondent **403** : noms des autres CSV
  **⚠️ À VÉRIFIER** (les noms `2_exercices.csv`… supposés répondent 404).
- **Champs organisation** (JSON) : `typeIdentifiantNational` (`SIREN`, `RNA`, `HATVP`…),
  `denomination`, `identifiantNational`, `categorieOrganisation{code,label,categorie}`,
  `ville`, `pays`, `lienSiteWeb`, dates de première/dernière publication, `activites…`.
  CSV : `representants_id; adresse; code_postal; dateCessation; derniere_publication_activite;
  date_premiere_publication; denomination; identifiant_national; activites_publiees; site_web;
  motifDesinscription; …`.
- **⚠️ DONNÉES PERSONNELLES** : le JSON contient `dirigeants[]`, `collaborateurs[]` (civilité,
  nom, prénom, fonction), téléphones, courriels. **Interdit de les importer.** Ne retenir que
  le niveau organisation : SIREN (quand `typeIdentifiantNational = SIREN`), catégorie, dates,
  indicateur « a publié des activités » — **ni dénomination ni nom d'usage** (voir l'addendum).
- **Rendu** : attribut « Répertoire HATVP » : inscrit depuis AAAA, catégorie, dernière
  publication d'activités, désinscrit/cessation le cas échéant. **Formulation neutre** :
  l'inscription au répertoire est une **obligation légale de transparence**, pas un indice
  de risque. Ne jamais lier une entreprise à un élu ou à un décideur (hors périmètre).

### 5.4 DECP — marchés publics (données essentielles) — priorité 4 (le plus lourd)
> ⚠️ **Corrigé et complété par `docs/lot-d-codex-d3-d4.md` (§4), qui prévaut** : un fichier
> mensuel n'est pas un mois de notification (fenêtre sur `dateNotification`), les titulaires
> sont dans `titulaires[].titulaire.id`, la clé à trois composants fusionne des contrats
> distincts, et le SIRET n'est pas validé par Luhn (exception La Poste).

- **Jeu** : data.gouv.fr, slug
  `donnees-essentielles-de-la-commande-publique-fichiers-consolides` (Ministères économiques
  et financiers, licence ouverte). API : `https://www.data.gouv.fr/api/1/datasets/<slug>/`
  → `resources[]` avec `url`, `filesize`, `last_modified`.
- **Ressources observées** (2026-10-10) : `decp-global.json` **1 056,6 Mo** ;
  `decp-2026.json` 591,9 Mo ; mensuels `decp-2026-10.json` 47 Mo, `decp-2026-09.json` 144 Mo,
  `decp-2026-08.json` 135 Mo, `decp-2026-07.json` 142 Mo, `decp-2026-06.json` 141 Mo,
  `decp-2026-05.json` 69 Mo ; **et des mensuels / annuels en remontant** (`decp-2025-12.json`
  … `decp-2025-01.json`, `decp-2025.json`, `decp-2024-*.json`, `decp-2024.json`…).
  Aucun parquet dans ce jeu (un `decp.parquet` ≈ 248 Mo, vu auparavant, vient d'un autre
  endroit — **inutile**, le JSON mensuel suffit).
  L'API tabulaire data.gouv sur ces fichiers renvoie 404 : **import obligatoire**.
- **Stratégie** : importer **les fichiers mensuels** (liste via l'API `…/datasets/<slug>/`,
  champ `resources[].title` de la forme `decp-AAAA-MM.json`) plutôt que le global ; JSON en
  flux (`stream-json` ou équivalent) ; fenêtre glissante **définie sur `dateNotification`**
  (12 mois, décision produit), et non sur le nom du fichier.
- **Schéma réel observé** (début de `decp-2026-10.json`, vérifié) :
  ```json
  {"marches": {"marche": [ {
    "id": "2024U018117000",
    "acheteur": {"id": "26760168000015"},
    "nature": "Marché", "objet": "…", "codeCPV": "33600000-6",
    "procedure": "Appel d'offres ouvert", "ccag": "…", "offresRecues": "NC",
    "typeGroupementOperateurs": "Pas de groupement",
    "lieuExecution": {"code": "FR", "typeCode": "Code pays"},
    "dureeMois": 6, "dateNotification": "2024-10-14",
    "datePublicationDonnees": "2023-08-04", "montant": 80000.0,
    "formePrix": "Unitaire",
    "titulaires": [ {"titulaire": {"typeIdentifiant": "SIRET", "id": "49904513600037"}} ],
    "source": "data.gouv.fr_pes", "…": "…"
  } ]}}
  ```
  Constats : **le titulaire n'a pas de dénomination** (seulement `typeIdentifiant` + `id`) ;
  **l'acheteur n'a pas de nom** (seulement son SIRET) → les libellés se résolvent par
  jointure (le SIRET acheteur peut être inconnu : ne pas inventer de nom, afficher le SIRET ou
  « acheteur public (SIRET …) »). L'`id` d'un marché n'est **pas unique** : un acheteur
  peut réutiliser le même `id` pour des contrats différents. **Identité d'une
  attribution = (`acheteur.id`, `id`, `codeCPV` normalisé, hachage de l'`objet`, `titulaires[].titulaire.id`)**
  (voir l'addendum). Le triplet (`acheteur.id`, `id`, `codeCPV`) correspond à l'`uid` publié par le projet de consolidation
  des DECP depuis août 2026 (`acheteur_id` + `id` + `_` + `codeCPV`, notes de version
  v2.13.0 / v2.14.0 de `ColinMaudry/decp-processing`) — la paire (`acheteur.id`, `id`)
  fusionnait à tort des contrats distincts. Normaliser `codeCPV` comme eux (v2.9.1 : moins
  de 8 caractères → complété par des `0` ; plus de 8 → raccourci ; sans le chiffre de
  contrôle). Les anciens fichiers peuvent porter l'ancien `uid` : ne pas s'y fier, calculer
  la clé soi-même. `dateNotification` : `AAAA-MM-JJ`. `montant` : nombre (flottant).
  **⚠️ À VÉRIFIER** sur un échantillon plus large : présence de `modifications`,
  `typeIdentifiant` autre que `SIRET` (`TVA`, `HORS-UE`…), marchés sans titulaire (accords-cadres).
- **Qualité (important)** : doublons entre fichiers (même clé naturelle, voir ci-dessus),
  modifications du même marché, montants aberrants (999 999 999, 0), SIRET invalides ou de personnes physiques,
  `typeIdentifiant` ≠ `SIRET`. Dédoublonner, valider le SIREN (Luhn ; **pas** le SIRET complet : exception La Poste et NIC
  malformés), plafonner les montants
  irréalistes **sans les supprimer** (marquer « non fiable »).
- **Rapprochement** : `titulaires[].titulaire.id` (avec `typeIdentifiant = SIRET`) → SIREN =
  `substr(id,1,9)`. Aussi côté **acheteur**
  (une collectivité/EP peut être le sujet du dossier).
- **Rendu** : attributs (nombre de marchés attribués sur la période, montant cumulé déclaré,
  principaux acheteurs, dernière notification) + événements datés `marche_public_attribue`
  (kind **distinct** de `marche_public_resultat` du BOAMP) plafonnés (≈ 20). À la différence
  du BOAMP (« mentionnant l'entreprise »), un titulaire DECP est **déclaré** : libeller
  « marché notifié à… (titulaire déclaré dans les DECP) » — toujours sans jugement.
- **Exclusion** : entrepreneurs individuels (cf. doctrine 3).

### 5.5 DGAL et EITI — ⚠️ SOURCES NON IDENTIFIÉES, NE PAS COMMENCER SANS DÉCISION
- **DGAL** : le seul jeu du portail `dgal.opendatasoft.com` est `export_alimconfiance`,
  **déjà branché au lot B**. Aucun jeu « agréments sanitaires / SIGAL » n'a été trouvé sur
  data.gouv.fr ni data.economie.gouv.fr (recherches « agréments », « SIGAL », « établissements
  agréés » : 0 résultat). Si un besoin précis existe (liste des établissements agréés
  CE/UE), **le demander à l'utilisateur avec le nom exact du jeu** avant tout code.
- **EITI / ITIE France** : aucun jeu exploitable trouvé sur data.gouv.fr (« ITIE »,
  « transparence industries extractives » : 0 résultat). Les rapports ITIE sont publiés en
  PDF/Excel sur le site de l'initiative. **Recommandation : sortir EITI du lot D** (pas de
  donnée structurée par SIREN) sauf demande explicite.

## 6. Ordre de livraison et découpage des PR

| PR | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| D0 | Infra : tables `open_data_imports`, workflow GitHub Actions, utilitaire de flux/lots, suffixe `(source non importée)` | socle commun, testé sur une source simple |
| D1 | **Camino** (7 Mo) de bout en bout : import + connecteur + rendu + tests | valide l'infra sur le cas le plus léger |
| D2 | **ICPE nationales** (190 Mo, API paginée) | remplace la limite du lot C |
| D3 | **HATVP** organisations (138 Mo JSON en flux, minimisation) | |
| D4 | **DECP** (fenêtre glissante, qualité) | le plus lourd et le plus délicat |

Chaque PR : une seule fonctionnalité, depuis `main`, description avec **SQL à coller**,
variables à poser (`X_ENABLED`), étapes d'activation dans l'ordre, tableau « vérifié sur les
vraies sources », limites connues. **Après fusion et activation, l'agent d'origine (Claude)
valide en production** sur EDF / LIDL / LA POSTE / HSBC : prévoir de quoi faciliter cette
validation (libellés stables, attributs nommés).

## 7. Étapes manuelles de l'utilisateur à prévoir (à lui demander explicitement, une fois)

1. **Secret GitHub** `DATABASE_URL_UNPOOLED` (URL **non poolée** de Neon) — lui indiquer où
   le copier dans Neon (« Connection details → Direct connection ») et où le coller dans
   GitHub. **Ne jamais lui demander de le coller dans le chat.**
2. **SQL de création des tables** (éditeur SQL de Neon), idempotent.
3. **Lancer le workflow** une première fois (« Actions → Import open data → Run workflow »),
   puis vérifier le résumé du job (nombre de lignes, durée).
4. Poser `X_ENABLED=true` dans Vercel (Production) et redéployer.

## 8. Critères d'acceptation (définition de « terminé »)

- [ ] Import **reproductible et idempotent** ; relancer ne change rien ; un échec en cours
      n'altère pas les données servies.
- [ ] Mémoire bornée (traitement en flux) ; durée du job < 30 min par source.
- [ ] Le connecteur distingue **absent / non importé / en échec**.
- [ ] Aucune donnée personnelle de personne physique en base ni à l'écran (vérifié par test).
- [ ] Création d'un dossier : **aucune dégradation de durée mesurable** (> 100 ms par source).
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npx eslint src` verts ; migrations idempotentes
      sans BOM.
- [ ] Vérifié sur les vraies sources (tableau dans la PR).
- [ ] Documentation : `.env.example`, `docs/`, page Réglages (fraîcheur de l'import visible).

## 9. Décisions à faire trancher par l'utilisateur AVANT de coder

1. Quota de stockage Neon réel (plan, Go disponibles) → fenêtre DECP (12 / 24 / 36 mois).
2. Entrepreneurs individuels : exclusion totale (recommandé) ou agrégat anonyme ?
3. Événements dans le graphe (DECP, Camino) ou attributs seulement ?
4. EITI et DGAL-agréments : confirmer l'abandon (cf. 5.5).
5. Souhait d'une mention de fraîcheur de chaque jeu dans la page Réglages.
