# Frontend Integration Contract

## Backend

Run from `backend/`: `python -m uvicorn api.main:app --reload`. Swagger: `http://127.0.0.1:8000/docs`.

## Photo intake (working demo)

`POST /imagem/analisar`, `multipart/form-data`:

- `foto`: JPEG, PNG, or WEBP file (max 10 MB)
- `produto_declarado`: non-empty product label

```javascript
const data = new FormData();
data.append('foto', photoBlob, 'product.jpg');
data.append('produto_declarado', productName);
const response = await fetch(`${API_URL}/imagem/analisar`, {method: 'POST', body: data});
if (!response.ok) throw new Error(`Photo upload failed: ${response.status}`);
const result = await response.json();
```

Do not manually set the `Content-Type` header for `FormData`. Example output:

```json
{
  "ambiente": "DEMONSTRACAO",
  "modo": "simulado_sem_ia",
  "status": "compatibilidade_simulada",
  "produto_declarado": "castanha",
  "produto_aparentemente_compativel": null,
  "qualidade_imagem": "resolucao_adequada",
  "dimensoes": {"largura": 604, "altura": 400},
  "autenticidade_verificada": false,
  "gps_verificado_pela_imagem": false,
  "pode_emitir_token": false,
  "motivo": "Image received successfully. Product compatibility was not assessed by AI.",
  "recomendacao": "Continue the demonstration flow; do not treat this result as a real validation."
}
```

UI wording: **Photo received and checked — demonstration mode.** Do not say **AI-approved product**.

## Environmental report

`POST /relatorio/gerar` with JSON:

```json
{
  "permissao_id": "DEMO-AUT-001",
  "latitude": -12.5,
  "longitude": -54.5,
  "precisao_metros": 15,
  "origem_localizacao": "demo",
  "raio_metros": 1000,
  "ano_inicial": 2024,
  "ano_final": 2025,
  "registro_id": "REG-001",
  "produto_id": "PRODUCT-001",
  "tentativa_id": "ATTEMPT-001"
}
```

Read `decisao_token.pode_emitir` and `decisao_token.status`. For `revisao_necessaria`, display a review state and do not create a token. For an allowed outcome, create only a labeled **experimental token**. Treat missing, unknown, or failed results as not approved. Confirm the exact report status vocabulary with the checked-in `api/token.py` before implementing frontend branching.

## GPS and demonstration geography

Phone GPS is collected separately from the JPEG. A photo captured in São Paulo must not be presented as evidence captured in a fictional Amazon property. Store the capture location and the analysis/demo location separately; mark the latter as `demo`. Blob URLs created by the browser cannot be sent to the backend as URLs; send the actual Blob/File bytes.

## Other routes

- `POST /sentinel/analisar`: live satellite screening (Earth Engine access required)
- `POST /imagens/satelite`: before/after/change images
- `POST /relatorio/pdf`: downloadable PDF
- `GET /permissoes/demo`: fictional permit data
- `GET /amazonia1/resumo`: precomputed demonstration data

Do not assume `/relatorio/pdf` accepts the same body as `/relatorio/gerar` without inspecting its Swagger schema.

## Connectivity

`localhost:8000` only works on the machine running the backend. For a phone or another laptop, configure a reachable IP or HTTPS endpoint, and update CORS origins. Keep API keys server-side.
