# Extraction documentaire — Docling (Kbis / statuts / comptes)

[Docling](https://docling-project.github.io/docling/) (IBM Research → Linux
Foundation, MIT) extrait des PDF **en local / air-gapped** — fort argument de
souveraineté pour Tracfin/DGSI. KYB Graph l'appelle via un **sidecar Python**
(le service reste à la charge de l'utilisateur) ; en mode démo / sans
`DOCLING_BASE_URL`, l'extraction provient d'une **fixture** (testable sans Python).

## Flux

```
POST /cases/{caseId}/upload  (multipart, champ « file »)
  → connecteur docling.extract(file)         (src/lib/connectors/docling.ts)
  → normalizeDocling(extraction)             (src/lib/ingestion/normalize-docling.ts)
  → addSourceDocument(caseId, source, {entities, edges})
        → fusion (résolution d'entités) + recalcul du risque + source_records
  → { ok, mode, entities, edges, merged }
```

Les identifiants produits suivent la convention `co:`/`pe:`/`ad:` (slugify), donc
les entités extraites **fusionnent** avec celles de Sirene/INPI déjà présentes.

## Contrat du sidecar `/extract`

`POST {DOCLING_BASE_URL}/extract` — `multipart/form-data`, champ `file`. Réponse
JSON (le service Docling fait l'OCR/mise en page, puis structure le Kbis) :

```json
{
  "document": "Kbis",
  "confidence": 0.97,
  "company": { "siren": "812345678", "denomination": "DUPONT HOLDING" },
  "dirigeants": [
    { "nom": "MARTIN", "prenoms": "Claire", "qualite": "Présidente" }
  ],
  "address": { "label": "12 rue de la Paix, 75002 Paris" }
}
```

> **Garde-fou** : ne renvoyer que des **dirigeants** (publics sur un Kbis), pas de
> bénéficiaires effectifs (gating CJUE — cf. `normalize-inpi.ts`).

## Démarrer le sidecar (exemple FastAPI)

```python
# app.py — squelette ; brancher Docling pour l'extraction réelle
from fastapi import FastAPI, UploadFile
from docling.document_converter import DocumentConverter

app = FastAPI()
converter = DocumentConverter()

@app.post("/extract")
async def extract(file: UploadFile):
    # 1. converter.convert(...) → texte/tables structurés (exécution locale)
    # 2. mapper vers le contrat { company, dirigeants, address }
    return { "document": "Kbis", "company": {...}, "dirigeants": [...] }
```

```bash
pip install docling fastapi "uvicorn[standard]" python-multipart
uvicorn app:app --port 8001
```

## Câbler KYB Graph

```bash
# .env.local
DOCLING_BASE_URL=http://localhost:8001   # absent → fixture (mode démo testable)
```

## Vérifier (mode démo, sans service Python)

```bash
# 1. Créer un dossier de session via la recherche, récupérer son id (s-...).
# 2. Téléverser n'importe quel PDF — l'extraction vient de la fixture :
curl -F file=@kbis.pdf http://localhost:3000/cases/<caseId>/upload
# → { "ok": true, "mode": "demo", "entities": N, "edges": M, "merged": K }
```

> **Note** : l'ajout fonctionne sur les dossiers **créés en session**. La
> persistance en base (Neon) de l'ajout de document est une vague ultérieure
> (`DbCasesRepository.addSourceDocument` lève une erreur explicite pour l'instant).
> Ajout du `source_kind` « docling » : pure modification TS en démo ; contre une
> vraie base, exécuter la migration `ALTER TYPE source_kind ADD VALUE 'docling'`
> (`npm run db:generate`).
