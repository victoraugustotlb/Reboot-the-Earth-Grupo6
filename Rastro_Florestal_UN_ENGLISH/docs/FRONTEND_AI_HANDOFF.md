# Prompt for the Frontend Team's AI Assistant

You are integrating the Rastro Florestal React frontend with an existing FastAPI backend. Do not rewrite or rename existing backend routes or JSON keys. Read `README.md`, `docs/FRONTEND_INTEGRATION.md`, and the OpenAPI documentation first.

Goals:
1. On a product attempt, send the actual image Blob/File and product label to `POST /imagem/analisar` as multipart form fields `foto` and `produto_declarado`.
2. Show image intake status as **demo-only validation**. The photo endpoint does not perform visual AI classification and cannot verify GPS or authenticity.
3. Keep the actual capture GPS separate from fictional Amazon-area demo coordinates; do not imply that a São Paulo photo was taken in the analyzed property.
4. Connect environmental report generation via `POST /relatorio/gerar` and read `decisao_token`. Never issue a token on review, unknown, or inconclusive results. An allowed token is experimental only.
5. Display satellite evidence and allow PDF download using the actual schemas in Swagger.
6. Handle HTTP errors, timeouts, missing credentials, and unavailable Earth Engine gracefully. Use explicit mock/demo responses when live data is unavailable.
7. Do not embed any OpenAI or Earth Engine credentials in React. Configure a reachable API URL for phone testing and ensure CORS is configured.
8. Keep UI labels and documentation in English if required by the hackathon; coordinate any backend API contract changes rather than silently renaming fields.

Provide a concise integration plan, changed files, exact run commands, and a checklist of end-to-end tests. Preserve local IndexedDB records and the relationship between product, attempt, photo, and location.
