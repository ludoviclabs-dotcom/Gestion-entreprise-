# Screening auto-hébergé — yente (OpenSanctions)

`yente` est le moteur de screening open source (MIT, FastAPI) d'OpenSanctions.
Il expose **le même contrat `/match/{dataset}`** que l'API SaaS — KYB Graph y
pointe par simple configuration, sans changement de code applicatif.

> **Souveraineté** : « no customer data leaves the deployment context ». Argument
> clé pour Tracfin/DGSI. **Licence** : le logiciel yente est gratuit (MIT) ; les
> **données OpenSanctions** exigent une licence commerciale dès le premier euro de
> revenu commercial — ne pas confondre licence du logiciel et licence des données.

## 1. Démarrer yente (Docker Compose)

```yaml
# docker-compose.yente.yml
services:
  yente:
    image: ghcr.io/opensanctions/yente:latest
    ports: ["8000:8000"]
    environment:
      YENTE_INDEX_URL: http://yente-index:9200
      YENTE_AUTO_REINDEX: "true"
    depends_on: [yente-index]
  yente-index:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
      ES_JAVA_OPTS: "-Xms2g -Xmx2g"
    ulimits:
      memlock: { soft: -1, hard: -1 }
    volumes: ["yente-es:/usr/share/elasticsearch/data"]
volumes: { yente-es: {} }
```

```bash
docker compose -f docker-compose.yente.yml up -d
# Premier démarrage : yente indexe les jeux de données (quelques minutes).
curl -s localhost:8000/readyz
```

## 2. Câbler KYB Graph

```bash
# .env.local
NEXT_PUBLIC_DEMO_MODE=false
OPENSANCTIONS_BASE_URL=http://localhost:8000   # instance yente locale
OPENSANCTIONS_DATASET=sanctions                # ou 'default' selon l'index yente
OPENSANCTIONS_AUTH_SCHEME=Bearer               # si yente exige un jeton ; sinon ApiKey
OPENSANCTIONS_API_KEY=<jeton-yente-optionnel>
OPENSANCTIONS_SELF_HOSTED=true                 # libellé « auto-hébergé » dans Réglages
```

Le connecteur ([src/lib/connectors/opensanctions.ts](../src/lib/connectors/opensanctions.ts))
construit l'en-tête `Authorization: <scheme> <token>` et POST le même corps
`{ queries: { … } }` qu'avec le SaaS. Aucune autre modification.

## 3. Vérifier la bascule

1. `GET /reglages` : la source **OpenSanctions** affiche « Screening auto-hébergé (yente) ».
2. Créer un dossier (recherche SIREN) ; l'onglet **Sources** doit montrer
   `endpoint = http://localhost:8000/match/...` (et non `api.opensanctions.org`).
3. Comparer un match connu entre SaaS et yente pour valider la parité de score.

## 4. Notes

- **Mémoire** : Elasticsearch demande ≈ 4–8 Go RAM. Pour la production souveraine,
  cibler un Elasticsearch managé UE (ou OpenSearch) chez OVHcloud/Scaleway.
- **Fraîcheur** : `YENTE_AUTO_REINDEX` rafraîchit les listes ; planifier sinon un
  réindex quotidien (cf. la trajectoire d'orchestration Prefect, vague ultérieure).
- **Garde-fou** : en mode démo (`NEXT_PUBLIC_DEMO_MODE` ≠ `false`), le connecteur
  reste sur fixtures — yente n'est interrogé qu'en mode live.
