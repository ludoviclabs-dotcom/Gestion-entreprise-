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
