# 🌳 Verdifica

**An open-source prototype for accessible forest-product traceability.**  
Developed by **Group 6** during **Reboot the Earth 2026**, with United Nations participation.

We built Verdifica to help small-scale Amazonian forest producers document product origin and supporting evidence without navigating an unnecessarily costly or fragmented process. Our long-term vision is a simpler **digital green passport** that buyers, consumers and inspectors can consult.

## What we built

- **React application:** product and batch registration, photos, GPS evidence, records and QR labels.
- **Node.js / Express + SQLite:** local records, traceability links, public-facing views with reduced personal/location details, and experimental token issuance.
- **Python / FastAPI GeoAI:** environmental screening using **Sentinel-2**, **NDVI**, **Dynamic World** land-cover data and experimental **Amazônia-1** reference analyses.
- **Evidence reports:** satellite indicators, maps and downloadable PDFs for further review.

The prototype distinguishes simulated reference data from live satellite analysis. **Tokens and QR codes are demonstrations, not official environmental certificates or proof of legal origin.** The photo check validates file properties; it does not verify authenticity using AI.

## Run locally

**Requirements:** Node.js **22.13+** (24+ recommended), npm, and Python **3.10+**.

Clone the repository, open its root folder and run:

```bash
git clone https://github.com/victoraugustotlb/Reboot-the-Earth-Verdifica.git
cd Reboot-the-Earth-Verdifica
cp .env.example .env
npm install
npm run setup:geoai
npm run dev
```

**Windows PowerShell:** replace `cp .env.example .env` with `Copy-Item .env.example .env`. Do not overwrite an existing `.env`.

The single `npm run dev` command starts all three services:

| Service | Address |
| --- | --- |
| React application | http://127.0.0.1:5173 |
| Express API | http://127.0.0.1:3001/api/health |
| FastAPI documentation | http://127.0.0.1:8000/docs |

No remote database or manual SQL setup is required. The application runs locally; camera and GPS access require browser permission.

### Enable live satellite analysis (optional)

The app can show **precomputed Amazônia-1 demonstration data** without Earth Engine credentials. These results are **not** analyses of a newly registered property and **cannot authorize token issuance**.

To run live Sentinel-2 / Dynamic World screening:

1. Obtain access to Google Earth Engine and an enabled Google Cloud project.
2. Set `EE_PROJECT=your-project-id` in the root `.env`.
3. Authenticate locally:

   ```bash
   # macOS / Linux
   .venv/bin/earthengine authenticate
   ```

   ```powershell
   # Windows PowerShell
   .\.venv\Scripts\earthengine.exe authenticate
   ```

4. Restart `npm run dev`, open a saved record, and use **Environmental Screening / GeoAI**.

Live analysis also depends on available imagery and suitable recorded GPS evidence. A favorable screening result is only one condition in the **experimental** token workflow; missing or inconclusive evidence does not count as approval.

### Useful commands

```bash
npm run dev          # Frontend + Express + GeoAI
npm test             # Automated tests (no live Earth Engine calls)
npm run build        # Build frontend
npm run dev:web      # Frontend only
npm run dev:api      # Express API only
npm run dev:geoai    # FastAPI only
```

## Project structure

```text
frontend/       React interface
server/         Express API and SQLite persistence
geoai/backend/  Python FastAPI, satellite screening and PDF reports
shared/         Shared traceability and QR-label contracts
tests/          API tests
```

## Scope and limitations

Verdifica is a **hackathon MVP**, not a deployed government service. Environmental permissions used in the demo are simulated; satellite indicators cannot establish legality or prove deforestation on their own. Public traceability views and printable QR labels have different disclosure levels, so **do not use real producer data in the prototype without appropriate safeguards**. Full offline synchronization, institutional integrations, secure verification and field validation remain future work.

## Sustainable Development Goals

Our approach relates to **SDG 8** (Decent Work and Economic Growth), **SDG 12** (Responsible Consumption and Production), **SDG 13** (Climate Action) and **SDG 15** (Life on Land).

## Team — Group 6

Giovanna Franco de Carvalho · Victor Augusto Toledo Lúcio Borghi · Thales Prado Rocha dos Santos · Rafael Hoki Kuntz · Thiago Silva de Almeida

**Project report:** [Verdifica Technical Project Report](./Verdifica_LinkedIn_Final_Report.pdf) 

---

*We built Verdifica to make environmental evidence easier to organize, share and review — while keeping human verification central.*

