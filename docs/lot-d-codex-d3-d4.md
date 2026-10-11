# Lot D — suite pour Codex : D3 (HATVP) puis D4 (DECP)

> Addendum à `docs/lot-d-brief-codex.md` (le brief d'origine reste la référence pour la
> doctrine, les conventions et la checklist « ajouter une source »). **En cas de
> contradiction, ce document prévaut** : ses faits ont été vérifiés le 11 octobre 2026 sur
> les fichiers réels (HATVP complet, deux mensuels DECP). D0, D1 et D2 sont livrés et
> validés en production ; la perf 4 (registre des gels) est fusionnée.

## 0. Mission

Livrer **deux PR indépendantes, dans cet ordre**, chacune depuis `main` à jour :

1. **D3 — HATVP** : répertoire des représentants d'intérêts, niveau **organisation** seulement.
2. **D4 — DECP** : marchés publics (données essentielles), **fenêtre de 12 mois de
   notification**.

Ne pas commencer D4 avant que D3 soit fusionnée **et** activée par l'utilisateur.
Aucune autre source : DGAL-agréments et EITI restent **hors périmètre** (décision produit).

## 1. Prérequis — à vérifier avant d'écrire une ligne

```bash
git fetch origin && git log origin/main --oneline -15
ls drizzle | tail -5                                  # dernière migration : 0017
grep -n "ALL_SOURCES" scripts/import/run.ts           # camino, icpe, tresor_gels
test -f src/lib/connectors/camino.ts && test -f src/lib/connectors/icpe-import.ts
test -f src/lib/connectors/tresor-gels-import.ts
grep -n "isInformationalEvent" src/lib/graph/informational-events.ts
grep -n "source non importée" src/lib/connectors/degraded.ts
```

| Élément | État | Où |
|---|---|---|
| Socle d'imports D0 (`open_data_imports`, workflow, flux, lots, verrou) | fusionné (#42) | `scripts/import/lib/*`, `.github/workflows/import-open-data.yml` |
| D1 Camino, D2 ICPE | fusionnés, actifs en production (#43, #45) | `scripts/import/camino.ts`, `icpe.ts`, `src/lib/connectors/camino.ts`, `icpe-import.ts` |
| Presse GDELT collectée après la réponse | fusionné (#47) | `assembleCase(siren, { deferPress })` |
| Registre des gels importé chaque jour | fusionné (#48) | `scripts/import/tresor-gels.ts`, migration **0017** |

**Numérotation** : D3 prend la migration **0018**, D4 la **0019**. À chaque ajout d'une
source, étendre — sans rien écraser — le tableau `ALL_SOURCES` de `scripts/import/run.ts`,
l'option `source` du workflow, `IMPORT_LABELS` (`src/lib/data/import-freshness.ts`) et
`docs/lot-d-activation.sql`.

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
2. **Durée de création** : un dossier se crée en ≈ 4 s (instance chaude) à ≈ 10 s (froide) ;
   la perf 4 vise ≈ 4 s dans les deux cas. Chaque source ajoutée doit lire **la base** en une
   requête (< 100 ms). Aucun appel réseau synchrone nouveau. Mesurer avec
   `cases.metadata.timings` (onglet Sources du dossier).
3. **Lecture en un seul snapshot SQL** (en-tête d'import + lignes), comme `camino.ts` et
   `tresor-gels-import.ts` : jamais « lire l'import_id puis ses lignes » en deux requêtes.
4. **Absent ≠ non importé ≠ en échec** : suffixe `(source non importée)` déjà reconnu par
   `src/lib/connectors/degraded.ts` ; ne pas en inventer d'autre sans l'ajouter à la regex
   **avec un test**. Un jeu non importé n'est jamais « aucune présence ».
5. **Aucun effet sur les scores** : pas de nouveau signal de vigilance, pas de changement de
   `SCORE_MODEL_VERSION`. Les événements informatifs passent par
   `src/lib/graph/informational-events.ts` (`isInformationalEvent`) : y ajouter le nouveau
   `kind` **avec un test de non-régression** (scores identiques avec et sans les événements).
6. **Identifiants : ne pas utiliser `isValidSiret`** (`src/lib/siren.ts`). Il applique Luhn
   au SIRET complet, sans l'exception de La Poste (SIREN 356 000 000 : un SIRET est valide
   si la somme de ses chiffres est un multiple de 5) et rejette des NIC malformés dont le
   SIREN est pourtant réel. Règle de tout le lot D (déjà appliquée par D2) : **valider le
   SIREN** (9 chiffres, Luhn via `isValidSiren`, hors `000000000`), exiger 14 chiffres pour un
   SIRET, **ne pas interpréter le NIC**.
7. **Pièges d'outillage vérifiés** : `vitest` ne prend que `*.spec.ts` ; ne pas écrire
   `beforeEach(() => mock.reset())` (la fonction retournée est appelée comme nettoyage) ;
   `tsx` n'accepte pas l'`await` de haut niveau (envelopper dans `main()`) mais résout bien
   l'alias `@/` ; fichiers en CRLF dans l'arbre de travail ; `npm ci --legacy-peer-deps`.
8. **Validation de production par Claude** après activation : attributs à libellé **stable**,
   détail dans l'onglet Sources du dossier. Ne pas créer plus de dossiers de test que
   nécessaire (la liste de l'utilisateur en compte déjà une vingtaine).
9. **Secrets** : `DATABASE_URL_UNPOOLED` est déjà posé dans GitHub. Ne jamais demander à
   l'utilisateur de coller un secret dans la conversation ; ne jamais en journaliser.

## 3. D3 — HATVP (organisations)

### 3.1 Faits vérifiés le 11 octobre 2026 (fichier complet analysé)

- Fichier : `https://www.hatvp.fr/agora/opendata/agora_repertoire_opendata.json`
  (138,7 Mo, JSON `{"publications":[ … ]}`, mis à jour **quotidiennement**).
- **4 098 organisations seulement** : le poids vient des listes imbriquées (dirigeants,
  collaborateurs, clients, activités), pas du nombre d'organisations. 3 774 portent un
  SIREN (toutes à Luhn valide ; 3 773 distincts : **un SIREN est en double**), 203 un
  identifiant HATVP, 121 un RNA.
- Clés d'une organisation : `typeIdentifiantNational` (`SIREN`, `RNA`, `HATVP`),
  `identifiantNational`, `categorieOrganisation{code,label,categorie}`, `isActivitesPubliees`,
  `datePremierePublication` et `dateCreation` au format **`JJ/MM/AAAA hh:mm:ss`**,
  `dateDernierePublicationActivite` (même format, 3 459 présentes), `dateCessation`
  (**`JJ/MM/AAAA`**, 379 présentes) et `motifDesinscription` (valeurs **`CESSATION`** 240 /
  **`ABANDON`** 139 ; `motivationDesinscription` est du texte libre, 103 présents),
  `exercices[].publicationCourante{dateDebut, dateFin (JJ-MM-AAAA), nombreActivite,
  noActivite, dispenseDeclaration, defautDeclaration}`.
- **Données personnelles et noms de personnes, à ne jamais projeter** : `dirigeants[]`,
  `collaborateurs[]` (civilité, nom, prénom, fonction), `telephoneDeContact`,
  `emailDeContact`, `adresse`, comptes sociaux, `clients[]`, `affiliations[]`, **et
  `denomination` / `nomUsage` / `sigleHatvp` / `nomUsageHatvp` / `ancienNomHatvp`**.
  Pourquoi les dénominations aussi : 76 organisations relèvent de catégories individuelles
  (`TRAIND` Travailleur indépendant 66, `COIND` Consultant indépendant 9, `AVIND` Avocat
  indépendant 1) et leur `denomination` est un **nom de personne** (« JULIETTE BLAYAC »,
  « LABRADOR LOUIS ») ou le marqueur « [ND] [ND] » avec le nom de la personne dans
  `nomUsage`. Les cabinets d'une seule personne d'autres catégories (`CABCON`…) sont
  indétectables : **aucune dénomination n'est donc conservée**.
- Fiche publique d'une organisation (vérifiée, HTTP 200) :
  `https://www.hatvp.fr/fiche-organisation/?organisation=<SIREN>` — un lien dérivable du SIREN,
  **rien à stocker**.
- Témoins (présence au répertoire) : EDF 552081317, LIDL 343262622, LA POSTE 356000000 et
  DANONE 552032534 **inscrits** ; HSBC Continental Europe 775670284 **absent**.
- Les index de dossiers renvoient 403 : ne pas chercher d'autres CSV. **Utiliser le JSON.**

### 3.2 Projection (liste blanche stricte)

Une ligne par organisation **ayant un SIREN valide** (`typeIdentifiantNational = 'SIREN'`,
9 chiffres, Luhn, hors `000000000`) ; en cas de SIREN en double, garder l'enregistrement dont
`dateDernierePublicationActivite` est la plus récente, à défaut `dateCreation`.

| Colonne | Source | Remarque |
|---|---|---|
| `siren` | `identifiantNational` | clé de rapprochement |
| `category_code`, `category_label`, `category_group` | `categorieOrganisation.*` | libellés institutionnels, pas de personne |
| `first_published_on` | `datePremierePublication` | date ISO (heure ignorée) |
| `last_activity_published_on` | `dateDernierePublicationActivite` | nullable |
| `activities_published` | `isActivitesPubliees` | booléen **nullable** : inconnu ≠ faux |
| `last_exercise_end` | max des `exercices[].publicationCourante.dateFin` | date ISO, nullable |
| `activity_count_last` | `nombreActivite` du dernier exercice | entier nullable |
| `no_activity_declared` | `noActivite` du dernier exercice | nullable |
| `ceased_on` | `dateCessation` | date ISO, nullable |
| `deregistration_reason` | `motifDesinscription` | **valeur fermée** `CESSATION` / `ABANDON`, sinon `null` |

**Aucune dénomination, aucun nom d'usage, aucun site web, aucune adresse** : le nom affiché
est celui de la société (Sirene), le lien vers la fiche officielle se calcule. Les
entrepreneurs individuels restent conservés (décision produit) : SIREN et informations
professionnelles (catégorie, dates, volumes d'activité), **jamais** leur nom.
Test obligatoire : un JSON d'entrée volontairement piégé (dirigeant, courriel, téléphone,
**organisation `TRAIND` dont `denomination` et `nomUsage` sont des noms de personnes**) →
**aucune** de ces valeurs dans les lignes projetées, ni dans l'attribut rendu.

### 3.3 Table, import, lecture

- Table `hatvp_organisations` : `import_id` (FK `open_data_imports(id)` **ON DELETE
  CASCADE**), clé primaire `(import_id, siren)`, index `(siren, import_id)`.
- Source `hatvp`, version de projection `hatvp-v1`. Fichier de 138 Mo : **flux JSON**
  (aucune bibliothèque de flux JSON n'est présente — seulement `csv-parse` : ajouter
  `stream-json` ou équivalent, le justifier dans la PR, vérifier `npm ci --legacy-peer-deps`),
  plafond d'octets via `Fingerprint`, **jamais** le fichier entier en mémoire dans l'import.
  Seuils de sanité : au moins 1 000 organisations et 1 000 SIREN ; refuser un schéma non
  reconnu (clé `publications` absente ou vide).
- Cadence : le fichier change chaque jour mais l'information (inscription, catégorie,
  exercices) évolue lentement → **mensuel** suffit (workflow `all`). Afficher la date d'import.
- Connecteur `src/lib/connectors/hatvp.ts` : flag `HATVP_ENABLED`, mode démo → fixture ;
  une seule requête SQL (snapshot) ; `(source non importée)` si aucun import validé.
- Normaliseur et rendu : attribut **« Répertoire HATVP »**, par exemple
  « Inscrite au répertoire HATVP depuis 2025 — catégorie : Société commerciale et civile —
  exercice clos le 31/12/2025 : 0 activité déclarée — fiche officielle : <lien> — jeu importé
  le 2026-10-12 », ou, pour une cessation, « Désinscrite le 12/03/2025 (cessation) ».
  **Formulation neutre** : l'inscription est une **obligation légale de transparence**, pas un
  indice de risque. Une entreprise **absente** du répertoire n'est pas « suspecte » : dire
  « non inscrite dans le jeu importé » seulement si un import validé existe.
  Aucun événement, aucun lien, aucune règle. Ne jamais relier une organisation à un élu ou à
  un décideur.

### 3.4 Tests et vérification réelle

Mêmes familles que D1/D2 (`src/tests/unit/camino-import.spec.ts`, `icpe-import.spec.ts`,
`icpe-national.spec.ts` comme modèles) : projection, minimisation, dates `JJ/MM/AAAA hh:mm:ss`
et `JJ-MM-AAAA`, SIREN invalides, SIREN en double, valeurs de `motifDesinscription` hors
liste, fichier tronqué, flux interrompu sans empreinte, upsert, lecture SQL (absent / non
importé / erreur), rendu neutre, **aucun champ personnel ni nom**.
Vérification réelle : télécharger le vrai fichier en flux ; donner dans la PR : organisations,
SIREN retenus, doublons, durée, pic mémoire, SHA-256, et le tableau des témoins ci-dessus.

## 4. D4 — DECP (marchés publics)

### 4.1 Faits vérifiés le 11 octobre 2026 (deux mensuels analysés : 2026-10 et 2026-05)

- Jeu data.gouv.fr `donnees-essentielles-de-la-commande-publique-fichiers-consolides` :
  42 ressources ; mensuels `decp-AAAA-MM.json` (liste via l'API `/api/1/datasets/<slug>/`,
  champs `title`, `url`, `filesize`, `last_modified`). Poids des 12 derniers mensuels
  ≈ 1 243 Mo. URL directes de forme
  `https://static.data.gouv.fr/resources/<slug>/<horodatage>/decp-AAAA-MM.json` (suivre
  l'`url` fournie par l'API, ne pas la construire).
- **Un fichier mensuel n'est PAS un mois de notification.** `decp-2026-10.json` contient des
  notifications de **2015 à octobre 2026** (l'essentiel en 2024-2026 ; 63 % de ses
  22 919 marchés sont antérieurs à une fenêtre de 12 mois) ; `decp-2026-05.json` de **2017**
  à octobre 2026 (40 % de ses 28 346 marchés), alors qu'il porte le nom de mai. Les fichiers
  contiennent aussi des dates **aberrantes** : 11 antérieures à 2015 (année 0206, 0226…) et
  29 postérieures à la date d'analyse (jusqu'à 2066) sur 51 265 marchés. La fenêtre se
  définit donc **sur `dateNotification`**, jamais sur le nom du fichier.
- **Forme des titulaires (confirmée à 100 %)** :
  `"titulaires": [ {"titulaire": {"typeIdentifiant": "SIRET", "id": "…"}} ]` — l'identifiant
  est dans **`titulaires[].titulaire.id`** (et `titulaires[].titulaire.typeIdentifiant`).
  Valeurs de `typeIdentifiant` : `SIRET` (≈ 99,7 %), `TVA`, `HORS-UE`, `IREP`, `RIDET`.
- **Plusieurs titulaires par marché** : 1 à 6 et plus (≈ 1,5 % des marchés dans le mensuel
  d'octobre, ≈ 10 % dans celui de mai ; 6 % sur les deux). `montant` est celui **du marché entier**, pas de
  chaque titulaire. `typeGroupementOperateurs` vaut parfois « Pas de groupement » alors que
  plusieurs titulaires figurent : ne pas s'y fier.
- **L'identifiant d'un marché n'identifie pas un contrat.** Sur 51 265 marchés, 824 clés
  `(acheteur.id, id, codeCPV)` sont vues plusieurs fois (585 dans un même fichier, 239 entre
  fichiers). Pour un même titulaire sur une même clé : 559 cas sont la même republication
  (même objet, même notification) ; **73 sont des contrats distincts** qui réutilisent
  l'identifiant (objets différents) ; 28 ont le même objet mais une notification différente.
  Aucun champ `uid` dans ces fichiers bruts.
- `acheteur.id` : toujours un SIRET à 14 chiffres (SIREN à Luhn invalide pour 20 sur 51 265, tous dans le
  mensuel de mai).
- `codeCPV` : 8 caractères (`33600000`) ou 10 (`33600000-6`, avec chiffre de contrôle).
- `modifications[]` : 15 % (octobre) à 42 % (mai) des marchés ; forme
  `{"modification": {"id", "dateNotificationModification", "datePublicationDonneesModification",
  "titulaires": [ {"titulaire": {…}} ]}}`. Elles peuvent changer titulaires et montant.
- `montant` : toujours numérique ici ; 17 valeurs ≥ 999 999 999 dans le mensuel de mai.
- SIRET de titulaires : 479 sur 57 316 (0,8 %) ont un SIREN valide mais un SIRET qui échoue
  à Luhn : 3 de La Poste (exception documentée) et 476 NIC malformés, dont 412 (87 %) sont
  le SIREN suivi de 5 de ses propres chiffres (« 401494828 » + « 40149 »). Les rapprocher
  par SIREN les récupère.

### 4.2 Décisions produit déjà prises

- **Fenêtre initiale : 12 mois de notification** (`dateNotification` entre la date d'import
  moins 12 mois et la date d'import), **à mesurer avant activation** (voir 4.4).
- Entrepreneurs individuels **conservés** (SIREN/SIRET, informations professionnelles) ;
  aucun contact privé (DECP ne publie de toute façon aucun nom de titulaire). Les marchés
  dont le titulaire n'a pas de SIREN exploitable ne sont pas rapprochables : les compter,
  ne pas les inventer.
- **Attributs + événements datés plafonnés (20)**, comme Camino, **sans effet sur les
  scores ni les signaux** (kind `marche_public_attribue`, **distinct** de
  `marche_public_resultat` du BOAMP, déclaré informatif — voir §2 point 5).
- Libellé : « marché notifié à … (titulaire déclaré dans les DECP) » — toujours sans
  jugement ; un marché attribué n'est ni un indice de risque ni une relation d'influence.

### 4.3 Identité, fenêtre, projection et qualité

**Fenêtre.** Retenir un marché si `dateNotification` est une date ISO valide comprise entre
`début de fenêtre` et `date d'import` (inclus). Une date illisible, antérieure à 2015 ou
**future** est **comptée** (`invalid_notification_date`) et le marché est exclu de la
fenêtre ; jamais corrigée ni décalée. Sélection des fichiers : partir des mensuels dont le
mois est ≥ au mois du début de fenêtre, **mesurer** sur ces fichiers la part de marchés dans
la fenêtre (publier le tableau dans la PR) et ne lire que ceux qui en contiennent ; le nom du
fichier n'est qu'un moyen d'accès. Documenter l'hypothèse retenue et sa limite.

**Identité et unicité (corrige la clé du brief §5.4).** Une ligne de la table est une
**attribution** : un marché × un titulaire.
- identité du **marché** = (`acheteur.id`, `id`, `codeCPV` normalisé, `objet_hash`) où
  `objet_hash` = 12 premiers caractères hexadécimaux du SHA-256 de l'`objet` normalisé
  (minuscules, sans accents, espaces réduits) — **le texte de l'objet n'est pas stocké** ;
- identité de la **ligne** = identité du marché + `titulaires[].titulaire.id` (c'est elle qui
  porte la clé primaire `(import_id, acheteur_id, marche_id, cpv, objet_hash, titulaire_id)`) ;
  deux co-titulaires d'un même marché ont donc chacun leur ligne et chacun retrouve le marché ;
- à identité égale (republication, y compris entre fichiers) : garder la version de
  `datePublicationDonnees` la plus récente, à défaut celle du fichier le plus récent ;
- **ne jamais** dédoublonner sur la seule paire (`acheteur.id`, `id`) ni sur la clé à trois
  composants : cela fusionnerait des contrats distincts (73 cas observés). Limite à dire :
  deux contrats distincts de même acheteur, identifiant, CPV, titulaire **et** objet restent
  fusionnés (28 cas observés ; notification ou montant divergents).
- Publier dans le résumé du job : marchés lus, hors fenêtre, dates invalides, lignes
  attribution, titulaires non SIRET, SIREN invalides, republications fusionnées, lignes
  conservées.

**Colonnes** (liste blanche) : composants de l'identité, `titulaire_siren`
(`substr(titulaire.id,1,9)`), `titulaire_id_type`, `acheteur_siren` (`substr(acheteur.id,1,9)`),
`holder_count` (nombre de titulaires du marché, **tous types confondus**), `nature`,
`procedure`, `notified_on` (date ISO), `published_on`, `amount` (nullable),
`amount_unreliable`, `source` (champ `source` du marché), `file_month`.

- **Titulaires** : lire `titulaires[].titulaire.typeIdentifiant` et `.id`. Seul le type
  `SIRET` est rapproché ; `TVA`, `HORS-UE`, `IREP`, `RIDET` sont comptés, non stockés comme
  rapprochables (ils comptent dans `holder_count`).
- **SIRET** : 14 chiffres, SIREN à Luhn valide (hors `000000000`), **NIC non interprété** ;
  ne pas appeler `isValidSiret` (§2 point 6). Un SIREN invalide est compté, non rapproché.
- **CPV** : retirer le suffixe de contrôle (`-6`) puis normaliser sur 8 chiffres (moins de
  8 → complété par des `0` ; plus de 8 → raccourci) — règle du projet de consolidation
  (notes v2.9.1).
- **Montants** : `0`, négatifs, ≥ 999 999 999 ou non numériques → ligne conservée,
  `amount_unreliable = true`, **exclue du cumul**, et dit. **Le montant est celui du marché** :
  il n'entre dans le cumul d'un SIREN que pour les marchés à **un seul titulaire**
  (`holder_count = 1`) ; les marchés à plusieurs titulaires sont comptés à part (« dont N en
  groupement, montant non réparti »). Ne jamais attribuer le montant entier à chaque
  co-titulaire, ni le diviser par convention.
- **Modifications** : non exploitées dans D4 (titulaires et montant = ceux de la
  notification) ; la limite est dite dans le rendu et la présence de `modifications` est
  comptée dans le résumé du job.

### 4.4 Volume, stockage, durée — à mesurer AVANT toute activation

L'abonnement Neon n'est pas modifié et son quota réel n'est pas confirmé. Dans la PR :
1. nombre de marchés et de lignes d'attribution dans la fenêtre, taille moyenne d'une ligne,
   **estimation du stockage** (`pg_total_relation_size` sur un jeu de test) ;
2. durée réelle du téléchargement en flux et du chargement, pic mémoire (≈ 1,2 Go de JSON à
   parcourir pour 12 fichiers, dont beaucoup de marchés hors fenêtre) ;
3. **plan B** si l'estimation est trop lourde : table agrégée par SIREN (nombre de marchés,
   cumul fiable des marchés à un seul titulaire, nombre en groupement, dernière notification,
   5 principaux acheteurs) **plus** les 20 marchés les plus récents par SIREN, calculés à
   l'import. La lecture reste une requête SQL.
Demander à l'utilisateur **le stockage disponible dans son plan Neon** (un nombre, sans
capture ni secret) avant de choisir entre le plan nominal et le plan B.
Limites à poser et tester : 25 min par ressource, plafonds d'octets par fichier, nombre de
fichiers, refus d'un fichier vide ou tronqué ; un fichier mensuel en échec **annule tout
l'import** (la fenêtre précédente reste servie).

### 4.5 Table, import, lecture, rendu

- Source `decp`, version `decp-v1`, flag `DECP_ENABLED`, table(s) avec FK `import_id`
  **ON DELETE CASCADE**, index `(titulaire_siren, import_id)` et
  `(acheteur_siren, import_id)`.
- Rapprochement : `titulaires[].titulaire.id` (type `SIRET`) → SIREN = `substr(id,1,9)`,
  **et** côté acheteur (une collectivité ou un établissement public peut être le sujet du
  dossier). Les décomptes se font par **marché distinct** (identité du marché), pas par
  ligne : un SIREN co-titulaire par deux de ses établissements n'est compté qu'une fois.
- Attributs stables : **« Marchés publics attribués (DECP) »** — nombre de marchés notifiés
  sur la fenêtre, montant cumulé **déclaré** (marchés à un seul titulaire et montant fiable,
  dit), marchés en groupement, dernière notification, principaux acheteurs identifiés par
  SIRET (ne pas inventer de nom), fenêtre et date d'import ; et **« Commande publique
  (acheteur, DECP) »** pour un acheteur.
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
- [ ] **Aucune donnée personnelle ni aucun nom de personne** en base ni à l'écran (test avec
      entrées piégées, dont une organisation individuelle).
- [ ] D4 : plusieurs titulaires = plusieurs lignes retrouvables ; fenêtre appliquée sur
      `dateNotification` ; montant d'un groupement jamais attribué en entier à chaque membre ;
      SIRET de La Poste et NIC malformés rapprochés par SIREN (tests dédiés).
- [ ] Aucun effet sur les scores ni les signaux (test de non-régression des scores).
- [ ] Création de dossier : surcoût < 100 ms par source (mesuré, dans la PR).
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npx eslint src scripts` verts.
- [ ] Vérifié sur les **vraies** sources (tableau dans la PR, scripts jetables supprimés).
- [ ] `.env.example`, `docs/lot-d-imports.md`, `docs/lot-d-activation.sql`, page Réglages
      (fraîcheur de l'import) mis à jour.
- [ ] Description de PR : **SQL exact à coller**, ordre d'activation, limites connues.
