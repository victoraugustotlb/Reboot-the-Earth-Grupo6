# Rastro Florestal — Forest Product Traceability MVP

**Status:** hackathon prototype; experimental environmental screening, not legal certification.

Rastro Florestal is an open-source-oriented digital public infrastructure (DPI) concept for small forest producers. It combines product registration and photo/GPS capture in a React application with a Python/FastAPI backend that provides satellite-derived environmental indicators and demonstration reports.

## Components

| Component | Implementation | Status |
|---|---|---|
| Producer interface | React, local product/attempt records, device photo and GPS | Team-owned; end-to-end integration not verified here |
| GeoAI | Google Earth Engine, Sentinel-2 SR, Dynamic World, NDVI, declared polygons | Previously exercised with real imagery |
| Amazônia-1 | INPE WFI precomputed experimental outputs | Reference/demo dataset, not live arbitrary-location analysis |
| Photo intake | Pillow file verification and resolution check | Demo endpoint; **no visual AI inference** |
| Reports | JSON, satellite imagery, ReportLab PDF | Previously tested |
| Token decision | Demo-only, fail-closed decision from environmental report | Integration must be checked with React |
| Permits | Local fictional GeoJSON/JSON data | Not authoritative |

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your own Google Cloud project ID.
set -a
source .env
set +a
earthengine authenticate
python -m uvicorn api.main:app --reload
```

Open http://127.0.0.1:8000/docs. Earth Engine endpoints require valid Earth Engine authentication; photo intake does not. The `.env.example` file contains placeholders only; copy it to `.env` and never commit the populated `.env`. The demo photo endpoint does not need `OPENAI_API_KEY`. Run `earthengine authenticate` once per developer machine/account as needed. `EE_PROJECT` is a Google Cloud project **ID**, not an API key.

## API endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/` | API status |
| GET | `/saude` | Health check |
| GET | `/amazonia1/resumo` | Precomputed Amazônia-1 summary |
| GET | `/amazonia1/inventario` | Precomputed scene inventory |
| GET | `/permissoes/demo` | Fictional permits |
| GET | `/relatorio/demo` | Demo report |
| POST | `/sentinel/analisar` | Live Earth Engine screening |
| POST | `/relatorio/gerar` | JSON environmental report and demo token decision |
| POST | `/imagens/satelite` | Satellite image previews |
| POST | `/relatorio/pdf` | Embedded-image PDF |
| POST | `/imagem/analisar` | Photo format/resolution check, no AI inference |

**Compatibility:** Existing routes and JSON field names intentionally remain in Portuguese to avoid breaking the React client. English comments and documentation do not imply an API contract migration.

## Photo endpoint example

```bash
curl -X POST http://127.0.0.1:8000/imagem/analisar \
  -F 'foto=@sample.jpg' -F 'produto_declarado=castanha'
```

A successful response includes `modo: "simulado_sem_ia"`, `produto_aparentemente_compativel: null`, and `pode_emitir_token: false`. A 200 response means the image was accepted, **not** that its content, provenance, GPS, or authenticity was verified.

## Security and operational notes

Never commit `.venv`, `.env`, Earth Engine credentials, or API keys. A previously shared OpenAI key should be revoked and replaced. The current demo photo endpoint does not require an OpenAI key. Browser `localhost` addresses refer to the browser's device, not the developer's Mac; use a reachable backend URL for phone testing. Review CORS before deployment.

## Documentation

- [Technical architecture and DPI design](docs/TECHNICAL_ARCHITECTURE_AND_DPI.md)
- [Frontend integration contract](docs/FRONTEND_INTEGRATION.md)
- [Development history and limitations](docs/IMPLEMENTATION_STATUS.md)
- [Handoff prompt for the frontend team](docs/FRONTEND_AI_HANDOFF.md)

## Demo-only artifacts

`demo_respostas/` and `pitch_apenas_nao_integrar/` contain fictional or presentation-only outputs. Do not treat them as evidence of regulatory compliance.

## Language and UN-facing presentation

All narrative documentation, source comments, human-readable error messages, and newly generated PDF labels are in English. Legacy API paths, JSON keys, status identifiers, and internal variable names remain unchanged for compatibility with the existing React application. See [Language and compatibility](docs/LANGUAGE_AND_COMPATIBILITY.md). Earlier Portuguese-only pitch PDFs have been excluded; generate new English PDFs using the backend.
