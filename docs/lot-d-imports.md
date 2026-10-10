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
