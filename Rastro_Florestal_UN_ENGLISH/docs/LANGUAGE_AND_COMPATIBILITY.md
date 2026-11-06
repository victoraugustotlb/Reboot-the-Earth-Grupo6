# English Language Policy and API Compatibility

**Audience:** UN-facing demonstration and technical reviewers. All explanatory documentation, comments, PDF headings, and human-readable response messages are in English.

## Deliberately unchanged machine-readable identifiers

The existing React integration relies on Portuguese-named endpoint paths, form fields, JSON keys, status enum values, and Python module/function names. These are **protocol identifiers**, not user-facing prose. Changing them without a coordinated frontend migration would break existing consumers. Examples: `POST /imagem/analisar`, `foto`, `produto_declarado`, `decisao_token`, `pode_emitir`, `divergencia_para_conferir`. The GeoJSON schema and Earth Engine dataset IDs are likewise unchanged.

The fictional permit source discriminator `BASE FICTICIA - NAO OFICIAL` and the demo environment marker `DEMONSTRACAO` are preserved because token-decision checks compare them exactly. Their meanings are **FICTIONAL DATABASE — NOT OFFICIAL** and **DEMONSTRATION**. Frontend UI must display English labels instead of raw enum values.

## UI labels

- `divergencia_para_conferir` → **Review required**
- `sem_divergencia_detectada_nesta_analise` → **No discrepancy detected in this analysis**
- `evidencia_insuficiente` → **Insufficient evidence**
- `simulado_sem_ia` → **Demonstration only — no AI image classification**
- `compatibilidade_simulada` → **Photo accepted; visual compatibility not assessed**
- `rastro_experimental` → **Experimental traceability token**

## Suggested future version

Add `/v2/` endpoints with English paths and request/response keys only after agreeing on a migration with the frontend team. Do not silently rename the v1 protocol during the hackathon.
