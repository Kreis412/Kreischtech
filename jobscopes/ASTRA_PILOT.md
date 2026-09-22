# Astra photo pilot — 2026-09-22

The owner authorized $5 initially and later allowed another $5 if needed. The installed pilot remains conservatively limited to five $1 request reservations; no extra credits were purchased. Every outbound attempt reserves a slot before sending. Failed/uncertain attempts retain the reservation. This is a local installation allowance, not subscription billing or a provider-enforced dollar limit.

Four requests used 8,377 input tokens and 728 output tokens. At the verified standard Astra prices of $10/M input and $50/M output, estimated usage was $0.12017. This is a calculation from returned usage, not a reconciled invoice. The first request received a 1-pixel image due to an integer overload in Windows resizing. Fixed to double precision, visually checked the prepared image, and added minimum/maximum output dimension validation. The failed-image attempt remains counted.

Corrected sample results:
- Deck: 8.36 seconds, correctly identified elevated deck and visible loose objects along access routes.
- Storefront: 9.47 seconds, correctly identified glazing and cladding; flagged visible walkway crack and loose items without asserting hidden damage.
- Interior: 5.06 seconds, correctly identified room and uncovered electrical fitting; explicitly left wiring and energized status unknown.

These are three smoke-test scenes, not a measured accuracy benchmark. More independent photos, difficult lighting, close-ups, commercial work, false-positive review and missed-concern review are required before release claims. No structural/buildability approval is produced.

Cloud analysis sends only one prepared photo (JPEG, maximum 1600px, metadata omitted) and up to 2,000 characters of user context. Responses uses store:false; this does not mean zero provider retention. No external tools, automatic retries or model fallback. Output limit 2,400 tokens, low reasoning, standard service tier. Findings remain Needs review. Same project/photo/model returns saved findings without a new request. Context revisions do not currently trigger a rerun.

Keys remain DPAPI-encrypted in ignored local data and are decrypted only for the server request. Browser never receives the key. No cloud expenses are automatically posted to the business ledger. Pilot does not support hosted credentials or multi-company billing allocation yet.

Sources checked:
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/your-data

## Equipment & Fleet milestone

Dedicated inventory page: create/edit/retire, unique tags, optional vehicle details, project assignment, responsible person, manually entered location and meter readings, next-service date/reading, registration reminders, permanent service history and optional costs. Owner/Manager writes; Viewer reads with structured service costs redacted. Service cost is a reference, not an automatic ledger expense. No GPS, telematics, recurring service calculation, stock quantities, or attachment uploads yet. Meter corrections and service-entry corrections need a future audited workflow.

## Scoped follow-up

Four new representative images were tested with explicit addition, patio, music-room and bathroom scopes. Latency 9.22–14.33 seconds. Eight total requests used 17,037 input and 2,226 output tokens (estimated $0.28167 at standard rates). These results remain a small manual trial, not an accuracy claim. Private detailed report: data/site-review-2026-09-22.md. Not inserted into real projects. Local cloud-pilot.json now records the user-authorized ten-attempt maximum ($10 conservative reservations); default remains five when no authorization file exists. Product gaps: multi-photo consolidation, fuller scope-driven unknowns, panel identification specificity and more calibrated specialist referrals.
