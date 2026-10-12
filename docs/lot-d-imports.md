# Lot D — imports automatiques

## Décisions produit (10 octobre 2026)

- Réutiliser Neon, sans changer l'abonnement. Quota réel non confirmé. D4 : fenêtre DECP initiale de 12 mois, à mesurer avant activation.
- Conserver les entrepreneurs individuels : SIREN/SIRET et informations professionnelles utiles, sans exclusion automatique. Ne pas importer leurs coordonnées privées ni les contacts inutiles.
- Camino : attributs et événements **datés**, plafonnés ; ICPE : attributs. Aucun signal de vigilance ajouté.
- EITI et DGAL-agréments hors de D0–D2 ; les réexaminer ultérieurement si une source exploitable est identifiée.
- Afficher date du dernier import complet, dernière vérification et échec éventuel dans Réglages.

## D0 — socle

Le téléchargement est consommé en flux, avec un plafond d'octets défini par l'adaptateur.
Les écritures sont groupées par 500 lignes. Une transaction Postgres unique englobe
l'import et sa publication. Un verrou transactionnel par source empêche deux importeurs
de publier simultanément (attente maximale 5 s). Le workflow sérialise également les jobs.

Les nouveaux jeux doivent avoir une clé unique comprenant import_id + clé naturelle,
et une FK import_id vers open_data_imports(id) **ON DELETE CASCADE**. Chaque adaptateur
projette explicitement les seuls champs autorisés et dédoublonne avec ON CONFLICT.
Une fois tout le flux validé, le nombre réel de lignes est compté et l'import est marqué ok.
Les anciennes lignes du jeu sont purgées dans **la même transaction** ; les métadonnées
d'import restent disponibles. Tout échec annule l'intégralité des écritures ; la dernière
version validée reste servie. Une interruption brutale laisse aussi la précédente version.
Le statut running existe uniquement dans la transaction, il n'est pas présenté comme un
import complet dans l'interface.

Les connecteurs doivent lire le dernier import ok et ses lignes dans **une seule requête SQL**
(snapshot cohérent), avec total réel et liste plafonnée. Ne pas lire un import_id dans
une première requête puis ses données dans une seconde : une publication pourrait survenir
entre les deux. La publication est atomique au commit.

Même fichier (SHA-256 des octets décompressés) et même version de projection :
les écritures temporaires sont supprimées, aucune donnée/entrée historique dupliquée ;
seule checked_at avance. Changer la version de projection force le réimport, même si
les octets n'ont pas changé.

Un fichier national vide est refusé. Une entreprise absente d'un fichier validé est
un résultat vide ; une source sans import validé est **source non importée**, consultation
dégradée, jamais une absence. Une panne ne crée aucun résultat rassurant.
Les erreurs de pilotes et les lignes brutes ne sont jamais journalisées.
Les tentatives échouées portent aussi une date de fin (checked_at), afin qu'un échec
après attente du verrou soit classé après le succès qui l'a précédé.

## Activation D0 — aucune commande locale nécessaire

1. Dans **Neon → SQL Editor**, coller la migration D0 fournie dans la PR.
   Ne pas utiliser la connexion de .env.local (périmée). Ne pas exécuter db:migrate.
2. Fusionner la PR D0 vers main.
3. Dans Neon, **Connection details → Direct connection**, copier l'URL non poolée.
   Dans [GitHub → Settings → Secrets and variables → Actions](https://github.com/ludoviclabs-dotcom/Gestion-entreprise-/settings/secrets/actions),
   ajouter le secret **DATABASE_URL_UNPOOLED**. Le saisir exclusivement dans GitHub, jamais
   dans une conversation, un fichier versionné ou un log.
4. Dans **Actions → Import open data → Run workflow**, sélectionner main puis check.
   Le résumé doit indiquer « Infrastructure accessible ». D0 n'importe encore aucun jeu.
5. Après D1/D2 et leurs premiers imports validés seulement, ajouter la **variable GitHub**
   OPEN_DATA_IMPORTS_ENABLED=true pour activer la planification mensuelle
   (le 4 du mois à 03 h 17 UTC). Le job est limité à 60 minutes pour les deux sources
   séquentielles (25 minutes de téléchargement maximum par source, plus installation).
   Une source en échec ne bloque pas la suivante ; le job termine en échec si au moins
   un import échoue, avec un compte rendu distinct pour chaque jeu.
   Le déclenchement manuel reste disponible sans cette variable.

Aucun nouveau flag Vercel n'est nécessaire pour D0. La base déjà configurée suffit pour
afficher les états dans Réglages. Les flags des sources n'arrivent qu'avec D1/D2 :
**SQL → fusion → premier import réussi → flag Production → redéploiement**.

La livraison du code peut avancer avant l'activation : D0 affiche un état indisponible
si sa table manque ; D1/D2 doivent rester désactivés tant que leurs migrations et imports
ne sont pas validés. Une fusion seule ne constitue donc pas une activation des jeux.

## Limites de validation

Vérification réelle du socle le 10 octobre 2026 : CSV national Camino téléchargé
intégralement en flux, 7 279 800 octets, 816 blocs, 4,25 s, SHA-256
`255a5976979af75a53033658aae30a457c04811bb4520b95cab8429876407a43`.
Le script temporaire a été supprimé. Cette vérification porte sur le téléchargement
et l'empreinte ; l'analyse métier et les recherches par SIREN relèvent de D1.

D0 vérifie la mécanique de flux et le contrat transactionnel, sans utiliser le secret
local périmé. Les mesures Neon réelles (transaction, stockage et latence) nécessitent le
secret GitHub valide et le SQL appliqué. D0 ne garantit pas que le quota actuel suffit à
DECP ; aucune taille ni tarification de plan n'est présumée.

## D1 — Camino

L'import lit le CSV officiel complet en flux avec csv-parse (guillemets et champs
multilignes), limité à 32 Mio et 2 Mio par enregistrement. Les colonnes attendues,
leur unicité et les dates JJ-MM-AAAA sont validées. Un fichier de moins de 1 000
titres est refusé ; ce seuil conservateur ne garantit pas à lui seul l'exhaustivité
de l'export amont. Un CSV mal formé, une coupure réseau ou une erreur SQL annule
la transaction. Version de projection : camino-v1.

La clé est (import_id, title_id, siren). Les rôles titulaire et amodiataire sont réunis
sur une ligne ; les doublons sont mis à jour. Les identifiants sont strictement à
9 chiffres avec clé Luhn valide, hors 000000000. Aucun filtre de catégorie juridique :
les entrepreneurs individuels sont conservés conformément à la décision produit.
Champs conservés : identifiants, nom du titre, type, domaine, statut, substances,
départements, dates, rôles. Les noms des titulaires, adresses, contacts et géométries
ne sont jamais projetés. Certaines lignes sans SIREN exploitable ne sont pas rapprochables.

Le connecteur effectue une seule requête paramétrée, via l'index (siren, import_id).
Les totaux par statut/domaine et l'échéance la plus lointaine des titres déclarés valides
portent sur toutes les lignes rapprochées ; la liste est limitée aux 20 titres avec
les dates les plus récentes (y compris les échéances futures). La chronologie en tire
au maximum 20 événements datés. Une date de début n'est jamais présentée comme un octroi.
L'import est daté dans l'attribut stable « Titres miniers (Camino) » et dans Réglages.

Les deux nouveaux types titre_minier_debut et titre_minier_echeance sont informatifs.
Ils sont exclus de la copie du graphe et du dossier utilisée pour les métriques,
les règles et les scores, ainsi que du détail de qualité de preuve. Ils restent
visibles dans le graphe et la chronologie. Les anciens événements conservent leur
traitement et le modèle 2026.2 reste inchangé pour les dossiers existants.

### Activation

1. Appliquer d'abord le SQL D0 (0014), puis le SQL D1 (0015_camino_titres.sql)
   dans Neon SQL Editor. Ne pas lancer db:migrate.
2. Fusionner D1 dans main. La livraison du code peut précéder les migrations si
   CAMINO_ENABLED reste false ; une fusion seule n'active aucune consultation.
3. Ajouter, si nécessaire, DATABASE_URL_UNPOOLED dans les secrets Actions de GitHub
   (connexion directe Neon ; jamais ici). Lancer Import open data, branche main,
   source camino. Le résumé indique le nombre d'associations titre/SIREN et la durée.
4. Relancer le même import : si le fichier est identique, le résumé doit afficher
   « inchangé », la date de vérification avance et les données ne sont pas dupliquées.
5. Dans Vercel Production : CAMINO_ENABLED=true, mode live ; redéployer.
   Recréer un dossier pour consulter les nouvelles données. Les anciens dossiers
   ne sont pas enrichis automatiquement.
6. Après réussite, OPEN_DATA_IMPORTS_ENABLED=true dans les variables GitHub active
   le rendez-vous mensuel. D1 : all importe uniquement Camino. En cas de problème,
   désactiver CAMINO_ENABLED ; les données déjà importées sont conservées.

### Vérification réelle du 10 octobre 2026

CSV officiel analysé intégralement : 3 027 associations titre/SIREN projetées en
4,98 s, SHA-256 255a5976979af75a53033658aae30a457c04811bb4520b95cab8429876407a43.
La normalisation réelle produit l'attribut de fraîcheur pour chaque SIREN testé.

| SIREN | Titres rapprochés | Événements (plafond 20) |
|---|---:|---:|
| EDF 552081317 | 16 | 20 |
| LIDL 343262622 | 0 | 0 |
| LA POSTE 356000000 | 0 | 0 |
| HSBC Continental Europe 775670284 | 0 | 0 |
| Témoin absent 123456782 | 0 | 0 |

Le script jetable est supprimé. Cette vérification exerce le téléchargement,
l'analyse, la projection et la normalisation réels, sans persistance Neon. La lecture
SQL est vérifiée par doubles de test : absence/import manquant/erreur, paramétrage,
requête unique, schéma et plafond. La transaction réelle, la répétition dans Neon,
le quota occupé et la latence cible < 100 ms restent à mesurer après configuration
sécurisée. Aucun secret local périmé n'a été utilisé et aucun flag n'a été activé.

Relecture D1 : les événements enregistrés référencent explicitement la source Camino et sa preuve. Le filtrage des événements informatifs est partagé par le moteur de risque, les métriques de l’onglet Analyse et le repository de requêtes de graphe ; les anciennes annonces restent inchangées. Tests de régression dédiés.

## D2 — ICPE nationales (Géorisques)

L'import consomme les pages HTTPS fixes de l'API installations_classees (page_size=1000).
Les liens next fournis par l'API ne sont jamais suivis (ils pointent actuellement vers
un autre hôte en HTTP). Chaque page doit conserver le même total et le même nombre de
pages, porter le numéro attendu et le nombre exact d'enregistrements attendu. Une clé
codeAIOT absente ou dupliquée provoque un échec atomique : protège contre une page répétée
ou un décalage des résultats pendant la pagination. L'API ne fournit pas de snapshot
transactionnel ; une modification amont sans changement de total reste une limite.

Mémoire : une page JSON (32 Mio maximum), plus un ensemble borné d'identifiants courts
pour détecter les doublons. Limites : 384 Mio cumulés, 1 million d'identifiants, 1 000 pages,
au moins 1 000 lignes nationales, 90 s par page, 25 minutes pour l'import. La transaction,
le verrou et la publication atomique sont ceux de D0. Un échec conserve la précédente
version. La clé naturelle est codeAIOT, pas le SIRET : plusieurs installations peuvent
partager un établissement. Upsert sur (import_id, code_aiot), index (siren, import_id).

Les lignes Non ICPE sont exclues. Le rapprochement exige un SIRET strictement à 14 chiffres
avec préfixe SIREN valide (Luhn, hors zéros). Le NIC n'est pas validé par Luhn : il ne sert
pas au rapprochement par entreprise. Les entrepreneurs individuels restent inclus.
Le résumé Actions distingue lignes reçues, Non ICPE exclus, identifiants inutilisables
et lignes stockées. Les adresses, contacts, coordonnées géographiques, rubriques et
rapports ne sont jamais conservés. Seuls identifiants, nom professionnel, commune, NAF,
régime, Seveso, IED, priorité nationale, état et nombre/date d'inspections sont projetés.
Les valeurs booléennes manquantes restent inconnues, sans être présentées comme fausses.

Une requête SQL unique lit le dernier import ok et les sites du SIREN. Totaux par régime,
état, Seveso, IED et priorité, total d'inspections et dernière date portent sur tous les
sites ; la liste est limitée à 20 installations. Le nombre d'installations est distingué
du nombre d'établissements (SIRET distincts). Attribut stable : « Installations classées
(Géorisques) ». Il indique la date d'import et le rapprochement limité aux identifiants
exploitables publiés ; aucune promesse de couverture de sites sans identifiants.
Aucun nouvel événement ni effet sur les scores/signaux. SourceKind georisques réutilisé.

### Lecture et repli

- GEORISQUES_ENABLED=true + ICPE_IMPORT_ENABLED=true + mode live : lecture nationale,
  sans appel ICPE externe ni liste d'établissements Sirene si l'import existe.
- Import réussi, aucun site : absence dans le jeu importé, aucun repli réseau.
- Aucun import réussi : trace dégradée « source non importée », puis consultation directe
  historique (siège/établissements), trace séparée et couverture limitée explicitée.
- Erreur DB ou table manquante : consultation dégradée, pas de repli masquant l'erreur.
- ICPE_IMPORT_ENABLED=false : comportement direct du lot C inchangé. Mode démo ou
  GEORISQUES_ENABLED=false : aucun appel national.

### Activation D2

1. Appliquer le SQL D0 0014, D1 0015, puis D2 0016_icpe_sites.sql dans Neon SQL Editor.
2. Fusionner D2 depuis main. Le code peut précéder l'activation si ICPE_IMPORT_ENABLED
   reste false ; ne pas activer le flag avant le SQL et le premier import complet.
3. Configurer DATABASE_URL_UNPOOLED dans les secrets GitHub Actions, si nécessaire.
   Toujours saisir la connexion directe dans GitHub, jamais dans la conversation.
4. Actions → Import open data → Run workflow → main → icpe. Relancer à fichier identique
   pour vérifier « inchangé » et l'actualisation de la date de vérification.
5. Dans Vercel Production : GEORISQUES_ENABLED=true et ICPE_IMPORT_ENABLED=true, puis
   redéployer. Recréer EDF / LIDL / LA POSTE / HSBC pour contrôler l'attribut et les sources.
6. Après validation, OPEN_DATA_IMPORTS_ENABLED=true active le rythme mensuel. all importe
   maintenant Camino puis ICPE, en transactions indépendantes, et publie le résumé de
   chaque réussite immédiatement. Une panne ICPE n'annule pas un import Camino réussi.
7. Repli opérationnel : ICPE_IMPORT_ENABLED=false et redéploiement restaurent le lot C.

### Vérification réelle du 10 octobre 2026

139 pages / 138 777 lignes reçues ; 33 147 Non ICPE exclus ; 6 919 identifiants inutilisables ;
98 711 installations projetées. Durée 209,37 s, pic RSS mesuré 119 Mio (script Node local,
sans écritures Neon). SHA-256 concaténé des pages dans l'ordre :
20e45a85e2933c0eb5e16f4deea9d5381a9794bde8aa6edbff9b735584459444.

| SIREN | Installations | Établissements | IED | Inspections référencées |
|---|---:|---:|---:|---:|
| EDF 552081317 | 104 | 92 | 21 | 226 |
| LIDL 343262622 | 36 | 20 | 0 | 91 |
| LA POSTE 356000000 | 5 | 5 | 0 | 6 |
| HSBC Continental Europe 775670284 | 1 | 1 | 0 | 1 |
| Témoin absent 123456782 | 0 | 0 | 0 | 0 |

Le téléchargement, l'analyse, la projection et le normaliseur réels ont été exercés,
puis le script temporaire supprimé. Le connecteur SQL et les branches d'assemblage sont
vérifiés par doubles de test. L'exécution réelle de la transaction Neon, la répétition,
le stockage occupé et la latence cible <100 ms restent à mesurer après configuration.
Aucun secret local utilisé, aucun abonnement changé, aucun flag activé.

Pour une première activation, le fichier [lot-d-activation.sql](./lot-d-activation.sql) rassemble exactement les migrations 0014 à 0016 dans leur ordre. Il peut être collé en une fois dans Neon SQL Editor ; les migrations déjà appliquées sont idempotentes.

## Perf 4 — registre des gels (DG Trésor) en base

**Pourquoi.** Le registre (12 Mo) était téléchargé à chaque instance froide : 7 à 9 s sur
la création d'un dossier (0,1 s sur une instance chaude). Le cache mémoire est propre à
chaque instance et ne survit pas aux démarrages à froid.

**Principe.** Un import quotidien (04 h 47 UTC) copie le registre dans `tresor_gels_entries` ;
chaque dossier le relit en une requête SQL (≈ 2 000 lignes) et applique le MÊME rapprochement
(`matchGelsEntries`) que le téléchargement direct.

- **Minimisation.** Seules les personnes morales et les navires sont conservés (≈ 30 % du
  registre). Les personnes physiques ne sont jamais importées : le rapprochement les écarte
  déjà. Sont projetés : nom, nature, alias, date de publication et nombre total d'entrées.
  Ni identifications, adresses, dates de naissance, ni commentaires du registre.
- **Équivalence.** Test dédié : le rapprochement sur le registre filtré est strictement égal
  à celui du registre complet.
- **Fraîcheur, garde-fou de contrôle de sanctions.** Une copie dont la dernière VÉRIFICATION
  date de plus de 48 h n'est jamais servie : repli sur le téléchargement direct. Un registre
  inchangé fait avancer la vérification sans dupliquer les lignes (même mécanisme que D0).
- **Repli.** Import absent, périmé, illisible, table manquante ou erreur base : téléchargement
  direct, résultat identique, jamais un « aucune correspondance » issu d'une copie non datée.
  Contrairement à l'ICPE, le repli est transparent : même donnée, même algorithme.
- **Traçabilité.** Sur import : endpoint `db:tresor_gels_entries` et dates d'import et de
  vérification dans la charge utile ; sur repli : l'URL officielle, comme avant.
- **Réglages.** « Registre national des gels (DG Trésor) » : date du dernier import complet,
  dernière vérification, échec éventuel.

Version de projection : `tresor-gels-v1`. Source : `tresor_gels`.

### Activation

1. Coller [lot-d-activation.sql](./lot-d-activation.sql) dans Neon SQL Editor (idempotent) ou, au
   minimum, `0017_tresor_gels_entries.sql`.
2. Fusionner la PR (aucune consultation n'est modifiée tant que le flag est éteint).
3. Actions → Import open data → Run workflow → main → **tresor_gels**. Le résumé indique le
   nombre d'entrées conservées et de personnes physiques non conservées. Relancer : « inchangé ».
4. Vercel Production : `TRESOR_GELS_IMPORT_ENABLED=true`, puis redéployer.
5. Variable GitHub `OPEN_DATA_IMPORTS_ENABLED=true` (déjà posée si le rythme mensuel est actif) :
   active aussi le rafraîchissement **quotidien** du registre. Sans elle, la copie devient
   périmée au bout de 48 h et le téléchargement direct reprend automatiquement.
6. Repli opérationnel : `TRESOR_GELS_IMPORT_ENABLED=false` et redéploiement.

### Vérification réelle du 11 octobre 2026

Publication du 9 octobre 2026 : 6 609 entrées reçues, 4 647 personnes physiques non conservées,
1 962 lignes projetées (3 940 alias), 3,7 s de téléchargement et projection, pic RSS 208 Mio,
SHA-256 `e3ea96db76e3d8a55f873615d2287a7a6ad2d3aa274fc0b478e9b8a6428eb6d4`. La lecture SQL est
vérifiée par doubles de test ; la latence réelle depuis Vercel est à mesurer après activation.

## D3 — HATVP, organisations seulement

Version `hatvp-v1`, source `hatvp`, attribut stable **« Répertoire HATVP »**.
L'export JSON officiel est lu en flux avec `stream-json` (dépendance de développement,
utilisée uniquement par l'import Actions). Les chaînes privées ne sont pas assemblées :
filtrage des tokens avant reconstitution des seuls champs autorisés. Les catégories
sont reconstruites depuis un catalogue institutionnel vérifié (27 codes) ; un code
inconnu reste non renseigné, compté dans le résumé. Aucun libellé libre amont, aucune
dénomination, aucun nom d'usage, site web, contact, adresse, client, affiliation,
dirigeant, collaborateur ou motivation de désinscription n'est conservé.
Les tests utilisent exclusivement des marqueurs synthétiques, aucun nom de personne.

Seuls les SIREN strictement à 9 chiffres, Luhn valides et hors zéros sont rapprochés.
Les entrepreneurs individuels sont conservés avec leurs informations professionnelles.
Les RNA et identifiants internes HATVP ne sont pas rapprochés. Les doublons sont résolus
sur la date/heure de dernière publication d'activité, à défaut de création ; à égalité,
la première occurrence est conservée. L'heure et la date de création servent seulement
à ce choix, sans persistance. Le dernier exercice est celui dont la date de fin est la
plus grande. Ses booléens et son volume restent nullables (inconnu ≠ faux ≠ zéro).
Seules les valeurs fermées CESSATION / ABANDON sont conservées pour la désinscription.

Limites : 256 Mio décompressés, 100 000 organisations, profondeur 64, clés/scalaires
sélectionnés de 256 caractères maximum, 20 000 champs sélectionnés par organisation,
25 minutes de téléchargement ; au moins 1 000 organisations et 1 000 SIREN distincts.
Seule la projection minimale est conservée en mémoire pour résoudre les doublons.
Le fichier doit être intégralement valide avant les écritures par lots de 500.
Publication, idempotence SHA/version, verrou, purge et rollback utilisent le socle D0.
Table `hatvp_organisations`, PK `(import_id, siren)`, FK avec suppression en cascade,
index `(siren, import_id)`. Le dernier import ok et l'organisation sont lus dans une
seule requête paramétrée, sans appel externe pendant la création d'un dossier.

Un jeu jamais validé renvoie « source non importée ». Un premier import échoué ou une
panne DB est une consultation en échec. Une absence est affirmée uniquement dans un
jeu validé, avec sa date d'import. Après un échec de rafraîchissement, le dernier succès
reste servi et Réglages montre l'échec et la fraîcheur. Un exercice futur contenant zéro
activité peut être encore ouvert : le rendu dit « exercice se terminant le… » et précise
qu'il ne s'agit pas d'un bilan définitif. Aucun événement, lien, règle, signal ou effet
sur les trois scores ; modèle `kyb-risk-2026.2` inchangé, régression d'assemblage dédiée.

### Activation D3 — dans cet ordre

1. Dans **Neon → SQL Editor**, coller `0018_hatvp_organisations.sql` (D0 0014 est déjà
   appliqué). Le fichier `lot-d-activation.sql` est étendu sans retirer D0–D2/perf 4.
   Ne pas exécuter db:migrate.
2. Exécuter le contrôle ci-dessous ; **hatvp doit figurer avant manual**. S'il manque,
   arrêter l'activation et réappliquer l'ALTER TYPE avant toute fusion/activation.

   ```sql
   select string_agg(e.enumlabel, ', ' order by e.enumsortorder)
   from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'source_kind';
   ```

3. Fusionner la PR D3 vers `main`.
4. **GitHub → Actions → Import open data → Run workflow → main → hatvp**.
   Le secret `DATABASE_URL_UNPOOLED` est déjà en place. Relancer : à fichier identique,
   le résumé indique « inchangé » ; si l'export quotidien a changé, un nouvel import
   est normal. Attendre un import réussi avant le flag.
5. **Vercel → kyb-graph → Settings → Environment Variables → Production** :
   `HATVP_ENABLED=true`, en mode live déjà configuré.
6. Redéployer. La variable GitHub existante `OPEN_DATA_IMPORTS_ENABLED=true` inclut HATVP
   dans `all` chaque mois ; le rendez-vous quotidien reste limité à `tresor_gels`.
   Le job mensuel est désormais plafonné à 90 minutes pour les quatre sources.
7. Écrire **« D3 activé »** à Claude. Il vérifie les cinq témoins sur les dossiers nécessaires,
   l'attribut, les sources, les scores et `metadata.timings.hatvp` (<100 ms visés).
   Les anciens dossiers ne sont pas enrichis automatiquement. Repli opérationnel :
   `HATVP_ENABLED=false` puis redéploiement. D4 reste fermé avant fusion ET activation D3.

### Vérifié sur les vraies sources — 11 octobre 2026

Téléchargement, analyse, projection et normalisation complets de
[l'export officiel](https://www.hatvp.fr/agora/opendata/agora_repertoire_opendata.json),
sans secret local ni écriture Neon :

| Mesure | Résultat |
|---|---:|
| Organisations reçues | 4 098 |
| Lignes avec SIREN valide | 3 774 |
| SIREN distincts retenus | 3 773 |
| Doublons fusionnés | 1 |
| RNA / identifiants HATVP non rapprochés | 121 / 203 |
| Catégories inconnues | 0 |
| Octets décompressés | 138 692 637 |
| Durée complète, sans écritures Neon | 22,03 s |
| Pic RSS du processus Node | 154,95 Mio |
| SHA-256 | `aab891f3302a1e595a1681e670a613b0af0a5c4b0ea3d172f49ec43f7facba69` |

| Témoin | SIREN | Présence |
|---|---|---|
| EDF | 552081317 | Inscrite |
| LIDL | 343262622 | Inscrite |
| LA POSTE | 356000000 | Inscrite |
| DANONE | 552032534 | Inscrite |
| HSBC Continental Europe | 775670284 | Absente dans le jeu importé |

Vérification SQL complémentaire sur **PostgreSQL local PGlite**, avec les 3 773 lignes
réelles minimisées : migration exécutée deux fois, contrôle pg_enum, cinq témoins,
absence/import manquant/échec initial, rollback et cascade. 100 lectures de la requête
exacte : p95 2,35 ms, maximum 4,35 ms ; chargement 170 ms ; table et index 1 171 456 octets.
Ces mesures locales ne mesurent **pas** le réseau Vercel/Neon ni le job GitHub réel.
Les outils et scripts jetables sont supprimés avant livraison.

Limites connues : aucune couverture des RNA/HATVP, aucun contrôle de l'obligation
d'inscription ou de déclaration, aucune interprétation des défauts/dispenses,
pas de relations avec des personnes/décideurs ; fraîcheur mensuelle malgré un export
quotidien. Les seuils ne prouvent pas l'exhaustivité amont. Les nouvelles catégories
nécessitent une mise à jour du catalogue et de la version de projection. Les exercices
futurs et leurs zéros ne prouvent pas une absence définitive d'activité. La transaction
Neon réelle, la répétition dans Actions et la cible <100 ms depuis Vercel restent à
confirmer par Claude après activation ; aucun accès de production n'a été simulé.

## Sanctions internationales (hors UE)

**Pourquoi.** OpenSanctions (HTTP 402) ne couvre plus les listes américaines, britanniques,
onusiennes, suisses et canadiennes. Les cinq publications officielles sont gratuites, sans
clé, et se téléchargent en un fichier : elles sont importées chaque jour en base, comme le
registre français des gels, puis lues en une requête.

| Liste | Fichier | Entrées conservées (11 oct. 2026) |
|---|---|---:|
| États-Unis — liste consolidée (CSL : SDN, Entity List, DPL, ITAR, SSI, UVL, MEU, CMIC…) | CSV, 16,8 Mo | 16 591 |
| Royaume-Uni — UK Sanctions List | XML, 22 Mo | 1 667 |
| ONU — liste consolidée du Conseil de sécurité | XML, 2,2 Mo | 274 |
| Suisse — SECO (historique inclus : les radiations sont écartées) | XML, 42 Mo | 2 602 |
| Canada — mesures spéciales (SEMA) | XML, 2,9 Mo | 1 450 |

**Périmètre : organisations seulement.** Les personnes physiques, navires et aéronefs ne sont
jamais conservés ; ni adresses, ni identifiants personnels, ni commentaires. Sur les listes
américaines de contrôle des exportations le type est souvent vide : l'entrée est alors
`entity` si le nom ressemble à une organisation, sinon `unknown` (conservée pour ne pas
manquer une société, **jamais** présentée comme un signal).

**Import** (source par liste : `sanctions_us|uk|un|ch|ca`, version `sanctions-v2`) :
une transaction par liste, mêmes garanties que D0 (atomicité, verrou, empreinte, « inchangé »).
Table commune `sanctions_entries`, purge bornée à la liste importée. Garde-fous : taille
maximale par fichier, seuil minimal de lignes, schéma vérifié, redirection tolérée seulement
vers un hôte autorisé (l'ONU sert son fichier par un stockage à jeton temporaire ; l'URL
finale n'est jamais journalisée). Groupes : `sanctions` (les cinq), `daily` (registre des
gels + les cinq, chaque jour à 04 h 47 UTC), `all` (mensuel).

**Lecture** : une requête SQL (en-têtes d'import + candidates de chaque liste). Pré-filtre par
clés (préfixes de 5 caractères des mots significatifs), puis le MÊME rapprochement que le
registre des gels. Sont interrogés le sujet **et ses sociétés mères GLEIF** (quatre noms au
plus).

**Honnêteté de la couverture.**
- La réponse nomme chaque liste consultée avec sa date d'import et de dernière vérification
  (attribut « Listes de sanctions internationales ») : un « aucune correspondance » ne vaut que
  pour les listes qu'il nomme.
- Une liste absente, ou vérifiée il y a plus de 72 h, rend la consultation **partielle**
  (endpoint suffixé « (listes partielles) », comptée en échec, jamais une couverture complète).
  Les correspondances des listes disponibles restent rapportées.
- Aucun import validé : « source non importée », jamais une absence.

**Correspondances fortes et faibles.** Un rapprochement par nom est une hypothèse. Mesuré sur
906 sociétés françaises réelles, les noms génériques (« ATLAS », « ALLIANCE », « AM GROUP »)
produisaient 9 « fortes » sur 15 correspondances, dont 6 homonymes. Sont donc retenues dans le
graphe (et alimentent les signaux existants) seulement les correspondances :
organisation typée comme telle, nom interrogé distinctif (au moins deux mots dont un d'usage
non courant, aucun nom d'un seul mot), exactes — ou approximatives à ≥ 0,96 sur au moins
10 caractères. Les autres sont **signalées dans l'attribut**, sans nœud ni signal. Résultat sur
les mêmes 906 sociétés : 3 fortes, toutes véritables (filiales françaises de banques iraniennes
inscrites) ; rappel conservé sur les sociétés réellement listées (Rosneft, Sberbank, Mahan Air,
Huawei, SMIC, IRGC…). Limite : un nom d'un seul mot (« Sovcomflot ») reste en attribut.

Un seul code source (`sanctions_intl`) : la table des pays/sujets s'affiche dans l'onglet
Sources du dossier. Les listes de contrôle des exportations (BIS, ITAR) portent la mention
« Contrôle des exportations ou exclusion (≠ gel d'avoirs) ».

### Activation

1. Neon → SQL Editor : coller `drizzle/0019_sanctions_entries.sql` (ou
   `docs/lot-d-activation.sql`, idempotent). Puis vérifier l'enum :
   `select string_agg(e.enumlabel, ', ' order by e.enumsortorder) from pg_enum e
   join pg_type t on t.oid = e.enumtypid where t.typname = 'source_kind';` — la liste doit
   contenir `sanctions_intl`.
2. Fusionner la PR (aucun comportement ne change tant que le drapeau est éteint).
3. Actions → Import open data → Run workflow → main → **sanctions**. Relancer : « inchangé »
   pour chacune des cinq listes.
4. Vercel Production : `SANCTIONS_INTL_ENABLED=true`, puis redéployer.
5. `OPEN_DATA_IMPORTS_ENABLED=true` (déjà posée) assure le rafraîchissement quotidien.
6. Repli : `SANCTIONS_INTL_ENABLED=false` et redéploiement.

### Vérification réelle du 11 octobre 2026

Les cinq fichiers officiels, téléchargés et projetés par le vrai pipeline (sans écriture Neon) :
22 584 entrées, de 1,4 s (Canada) à 10,9 s (Suisse), pic mémoire 572 Mio. La requête SQL est
exécutée sur un vrai moteur PostgreSQL (PGlite) avec les migrations réelles. La latence depuis
Vercel est à mesurer après activation.

## Sanctions internationales — contrôle des PERSONNES (dirigeants)

**Pourquoi.** Les sociétés étaient contrôlées ; pas leurs dirigeants ni bénéficiaires. Un
dirigeant inscrit sur une liste est l'un des signaux les plus importants d'un contrôle KYB.
Mais un nom de personne est la donnée la plus sujette à l'homonymie : le dispositif est donc
construit pour la **précision**, au prix assumé d'un rappel limité.

**Données des listes** (table `sanctions_entries`, `kind = 'person'`, import v3) : nom,
alias, **années** de naissance (jamais la date), pays/nationalité, programme, date
d'inscription. Ni adresse, ni identifiant, ni commentaire. Environ 19 800 personnes
(États-Unis 7 615, Royaume-Uni 4 056, ONU 736, Suisse 3 841 en vigueur, Canada 3 526).

**Données du dossier.** L'**année** de naissance des dirigeants (Recherche d'entreprises /
RNE, Pappers, Companies House) est lue dans la charge brute de la source pour départager les
homonymes. Elle n'est **jamais affichée**, ni ajoutée à une fiche, ni persistée ailleurs.

**Règle de rapprochement** (module pur `sanctions-persons-match.ts`) :

| Nom | Année de naissance | Résultat |
|---|---|---|
| identique (ordre, casse, accents indifférents) ou inclus (≥ 2 mots) | concordante (≤ 3 années listées) | **corroborée** : nœud « sanction » en niveau *simulé*, lien `EST_VISE_PAR`, donc `PROXIMITE_SANCTION` |
| identique ou inclus | inconnue d'un côté, ou voisine (± 1 an) | **à vérifier** : attribut sur la personne, aucun nœud ni signal |
| identique ou inclus | connue des deux côtés et différente | **écartée** (comptée, jamais rapportée) |
| proche, translittéré, un seul mot | — | aucun rapprochement |

**Honnêteté de la couverture.** Une liste non importée avec les personnes (version < v3),
absente ou vérifiée il y a plus de 72 h rend le contrôle **partiel** ; aucune liste prête :
« source non importée », jamais « aucune correspondance ». La synthèse du dossier dit combien
de personnes ont été contrôlées, combien sans année de naissance (contrôle par le nom seul),
combien d'homonymes écartés et de personnes non contrôlées (limite 40 par dossier, nom d'un
seul mot).

**Mesures réelles (12 octobre 2026).** 1 978 dirigeants de grandes entreprises françaises
(1 975 avec année) contre 19 774 personnes listées : **0** correspondance de nom, 0 écartée —
aucun bruit. Auto-test de rappel : 1 516 personnes listées interrogées par leur nom (ordre
inversé) et leur année → 1 516 retrouvées et corroborées. 70 noms très courants dépassent
200 candidats : la limite garde d'abord les entrées partageant le plus de mots, et dit la
troncature.

### Activation — dans cet ordre

1. Neon → SQL Editor : coller `drizzle/0020_sanctions_persons.sql` (ou la fin de
   `docs/lot-d-activation.sql`, idempotent). Colonne + index uniquement ; aucun effet visible.
2. Fusionner la PR (aucun comportement ne change tant que les deux drapeaux sont éteints).
3. GitHub → Settings → Secrets and variables → Actions → **Variables** :
   `SANCTIONS_PERSONS_IMPORT_ENABLED=true`, puis lancer l'import « sanctions » (le pipeline
   écrit alors la version v3 ; relancer : « inchangé »).
4. Vercel Production : `SANCTIONS_PERSONS_ENABLED=true`, redéployer (exige
   `SANCTIONS_INTL_ENABLED=true`).
5. Repli : `SANCTIONS_PERSONS_ENABLED=false` et redéploiement ; le contrôle des sociétés
   n'est pas touché.


## D4 — DECP, marchés publics (plan agrégé)

Livré après validation D3 du 12 octobre 2026. Migration **0021_decp_summaries.sql**, source decp, version decp-v1-aggregate avec les bornes de fenêtre. Le plan B du §4.4 est retenu pour le quota Neon confirmé (0,21 Go utilisés sur 0,5 Go). Les totaux titulaire/acheteur couvrent tous les marchés distincts de la sélection de fichiers dans les douze mois de notification ; seules les vingt références récentes par SIREN/rôle et les cinq principaux acheteurs sont persistés. Aucune donnée nominative, aucun effet sur les scores/signaux, événements informatifs plafonnés à vingt.

Le fichier [validation et activation D4](lot-d-decp-validation.md) contient les mesures réelles, les limites, le SQL exact, le contrôle pg_enum et l’unique séquence d’activation. SINGLE_SOURCES/all inclut decp ; daily et sanctions sont conservés. Réglages reprend automatiquement son import et son fonctionnement observé via la déclaration CONNECTOR_SOURCE.

## Registres étrangers des sociétés mères (Norvège, Singapour)

**Principe.** GLEIF publie, pour la mère directe ou ultime d'une société, son **registre
d'origine** (code RA) et son **numéro d'immatriculation**. Le registre officiel du pays est
interrogé avec ce numéro : un rapprochement par IDENTIFIANT, donc sans homonymie — à la
différence d'un rapprochement par nom (voir l'essai Offshore Leaks : 13 correspondances de nom
sur 600 sociétés, presque toutes des homonymes). Même mécanique que Companies House.

| Registre | Code RA (vérifié GLEIF) | Accès | Ce qui est conservé |
|---|---|---|---|
| Norvège — Brønnøysundregistrene, Enhetsregisteret | RA000472 | API ouverte, sans clé | nom, forme juridique, statut (activité, faillite, liquidation, radiation), date d'immatriculation, dernier exercice déposé, effectif, activité |
| Singapour — ACRA (jeu data.gov.sg « Registered Entities with UEN ») | RA000523 | jeu ouvert, sans clé, 1 appel / 3 s | nom, type, statut, date d'immatriculation |

Ni adresse, ni dirigeant, ni téléphone, ni site. **Information seulement** : un attribut sur le
nœud société mère, sans nœud, lien ni signal ni effet sur les scores.

**Honnêteté.** Numéro inconnu → HTTP 404 (absence, pas une panne) ; limitation de débit (429),
erreur serveur, schéma inattendu ou délai dépassé → consultation dégradée, jamais « absent ».
Sources `brreg` et `acra` (valeurs d'enum, migration 0022) ; drapeaux `BRREG_ENABLED` et
`ACRA_ENABLED` (défaut `false`).

**Vérifié sur les registres réels (12 octobre 2026).** Equinor (923 609 016, 349 ms), Telenor
(982 463 718), DBS Group Holdings (199901152M), Singtel (199201624D) trouvés ; numéros inconnus
→ 404.

### Activation

1. Neon → SQL Editor : `drizzle/0022_registres_etrangers.sql` (ou la fin de
   `docs/lot-d-activation.sql`, idempotent), puis la requête de contrôle de l'enum : elle doit
   lister `brreg` et `acra`.
2. Fusionner la PR (rien ne change tant que les drapeaux sont éteints).
3. Vercel Production : `BRREG_ENABLED=true` et/ou `ACRA_ENABLED=true`, puis redéployer.
4. Repli : remettre les drapeaux à `false` et redéployer.
