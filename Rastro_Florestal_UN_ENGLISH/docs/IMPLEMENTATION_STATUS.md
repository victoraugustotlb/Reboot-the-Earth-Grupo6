# Implementation Status and Verification Notes

## Implemented and previously exercised

- FastAPI environmental endpoints and Earth Engine access on the developer's machine.
- Sentinel-2 / Dynamic World comparisons, including inside/outside polygon indicators.
- Experimental precomputed Amazônia-1 results.
- Environmental JSON reports and satellite visualization endpoints.
- PDF generation with embedded satellite imagery.
- Photo intake demo tested in Swagger with HTTP 200 using a 604×400 JPEG and declared product `castanha`.

## Attempted, but not operational in the final demo

- An external OpenAI vision API request reached the service but returned HTTP 429. The photo endpoint was replaced with an offline, deterministic validation-only demo. It does not classify product content.

## Demonstration-only

- Fictional permit `DEMO-AUT-001`, including a declared polygon and illustrative limits.
- Prewritten favorable and alert examples, pitch-only PDFs, and experimental token decisions.

## Not independently verified in this package

- Full React-to-backend end-to-end integration on a mobile device.
- Current Google Earth Engine credentials on another developer's machine.
- Official permit validation, real-world product provenance, image authenticity, or regulatory compliance.
- Production deployment, persistent server-side storage, authentication, security, or scalability.

## Compatibility policy

Keep Portuguese API paths, parameter names, and JSON keys until frontend and backend agree on a versioned migration. Comments and technical documentation are in English. Some existing user-facing report labels and response messages remain Portuguese because they are runtime content, not comments; translate them only in a coordinated localization change.

## Safe Git hygiene

Do not commit virtual environments, compiled bytecode, credentials, `.env`, private keys, or sensitive location data. Revoke the previously disclosed OpenAI API key. The demo photo endpoint needs no OpenAI key.
