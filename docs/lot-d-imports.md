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
   (le 4 du mois à 03 h 17 UTC). Le job est limité à 30 minutes.
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
