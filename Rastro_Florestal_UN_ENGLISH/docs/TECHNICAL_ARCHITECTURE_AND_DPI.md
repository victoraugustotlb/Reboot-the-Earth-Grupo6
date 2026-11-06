# Technical Architecture, Models, and Digital Public Infrastructure

## Executive summary

Rastro Florestal is a hackathon MVP for recording forest-product traceability evidence and performing preliminary satellite-based environmental screening. It is designed as a possible reusable building block for **digital public infrastructure (DPI)**, not as a functioning official public registry or licensing authority.

## System boundaries

```text
Producer phone / React UI
  | product record, attempt, photo, device GPS
  | HTTP JSON / multipart form
  v
FastAPI backend
  |-- /imagem/analisar --> Pillow image validation (DEMO, no visual AI)
  |-- /sentinel/analisar --> Earth Engine --> Sentinel-2 SR + Dynamic World
  |-- /amazonia1/* --> precomputed INPE Amazônia-1 WFI files
  |-- /permissoes/demo --> fictional permit polygons
  |-- /relatorio/gerar --> location + environmental indicators + demo decision
  |-- /imagens/satelite --> satellite visualizations
  `-- /relatorio/pdf --> embedded-image PDF
  |
  v
React: display review status, PDF, and demo token when permitted
```

## Models, datasets, and algorithms

### Sentinel-2 Surface Reflectance Harmonized

- Source: Copernicus Sentinel-2 surface reflectance through Google Earth Engine (`COPERNICUS/S2_SR_HARMONIZED`).
- Function: compare image composites between selected years in an area of interest.
- Demonstration example: June–September 2024 versus June–September 2025, radius 1 km, near (-12.5, -54.5).
- Output: vegetation-related spectral measurements and imagery. This is a satellite dataset, **not** a trained generative AI model.

### NDVI

Normalized Difference Vegetation Index: `(NIR - RED) / (NIR + RED)`. Used to flag decreases in vegetation signal. Seasonal patterns, agricultural cycles, clouds, and image quality may cause changes unrelated to illegal activity. NDVI is a deterministic index, **not** a machine-learning model.

### Google Dynamic World

A near-real-time land-cover dataset derived using machine learning from Sentinel-2. The backend examines possible transitions from `trees` to other classes, including `crops` and `grass`. Class changes are model estimates and **do not establish deforestation, causality, or illegality**. In this code, `trees=1`, `grass=2`, and `crops=4`.

### Amazônia-1 WFI (INPE)

Brazilian satellite data explored for spectral and temporal analysis. The backend serves **precomputed** demonstration results and scene inventory. The current API does not perform an equivalent live Amazônia-1 analysis for arbitrary locations. WFI's approximate 64 m spatial resolution imposes limitations for small parcels.

### Photo intake / image analysis

The tested demo mode uses **Pillow**, not a vision foundation model. It validates JPEG/PNG/WEBP, a 10 MB size limit, and a simple resolution threshold (minimum image dimension 300 pixels). It does **not** identify forest products, detect manipulation, validate GPS, or establish that a photo was taken at a claimed location. An earlier OpenAI vision integration was attempted but returned HTTP 429; it is not part of the final demo workflow.

## Spatial analysis and decisions

The backend accepts latitude, longitude, a radius, years, and optionally a declared GeoJSON `Polygon` or `MultiPolygon`. It computes change indicators inside and outside a declared polygon and assesses point-in-polygon compatibility. Polygon geometry and fictional permit limits are not verified against official government records. An observed change outside a declared polygon is a **review signal**, not a legal finding.

The report's `decisao_token` is an experimental gating response. A review-needed or inconclusive result must not issue a token. A favorable demo result may allow only a **demonstration traceability token**, never an environmental license or legal certification. Photo acceptance is independent of this decision.

## Example observed environmental indicators

An earlier live Earth Engine test around (-12.5, -54.5), 2024–2025, returned approximately 1.3504 ha of possible tree-cover class change: 0.2523 ha inside and 1.0981 ha outside the declared polygon, plus 1.3733 ha with NDVI decrease. The report status was `divergencia_para_conferir`. These are historical development-test outputs, not freshly reproduced results or proof of unlawful clearing.

## DPI design principles and planned evolution

**Open interfaces:** FastAPI publishes OpenAPI contracts; JSON, GeoJSON, and HTTP enable interoperable clients.

**Reusable building blocks:** separate registration, geospatial screening, photo intake, reporting, and decision modules. Other cooperatives or institutions could deploy or replace components.

**Inclusion:** prioritize low-friction mobile workflows and understandable explanations for small producers. Offline-first local registration is a frontend design direction; production-grade sync is not verified.

**Auditability:** future versions should preserve source imagery identifiers, dates, algorithm versions, declared geometry, uncertainty, report hashes, and decision history.

**Governance:** official use would require competent authorities, legally valid permissions, review and appeals processes, accountability, and published criteria.

**Privacy and security:** location and photos can be sensitive; add consent, authentication, access control, retention policies, encryption, and secure credential handling before deployment.

**Scalability:** decouple synchronous Earth Engine requests from user-facing workflows with jobs/queues, caching, monitoring, rate limits, and stable storage; adapt datasets and policies for different biomes and South American jurisdictions.

## Non-goals and disclaimers

This MVP is not an official digital public infrastructure deployment. It does not authenticate producers, certify provenance, prove that a photo matches GPS, confirm permit validity, or determine legal compliance. A lack of detected alerts is not proof of legality.
