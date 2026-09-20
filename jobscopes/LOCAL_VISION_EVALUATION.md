# Three-scene local vision trial — 2026-09-20

Model: installed Ollama gemma3:4b. No cloud requests. Six runs: original prompt and one scene-neutral revision on Deck.jpg, shop.jpg, apthouse2.jpg. Approximately 9–14 seconds per image. This is a qualitative screening, not a statistically valid accuracy score or a building inspection. No results were entered as actual project findings.

## Result: not ready for customer-facing site analysis

The original prompt carried basement-specific examples into unrelated scenes. Removed those examples and clarified that ordinary finishes and unfinished work are not defects. The revised prompt still produced unsupported findings.

| Image | Original output problems | Revised output problems | Useful visible topics for a human to verify |
|---|---|---|---|
| Deck | Invented overhead obstruction and irrelevant sound gap | Misidentified the loose white railing component as a ladder; asserted a loose connection without sufficient evidence | Apparent incomplete stair railing assembly; installed guards and stair details need closer views. Connections/footings cannot be assessed from this view. |
| Shop | Called decorative/finished elements unfinished; invented service access panel | Repeated uncertain panel misalignment and unfinished trim claims | Visible pavement crack; storefront/sill interfaces and partly boarded opening at right warrant documentation. No code, waterproofing or accessibility conclusions from the image. |
| Apartment | Claimed exposed framing without clear support | Claimed exposed grout/unsealed tile without establishing flooring material; asserted trim misalignment | Visible flooring transition at doorway and uncovered wall opening/box at lower right need closer images and context. Cannot identify wiring state or hidden construction. |

These are model errors, not findings about workmanship. Do not use the output to approve construction, quote remedial work, or judge the contractor. The all-passing software test suite checks API/validation/storage/security behavior, not visual truth. Next: compare a stronger vision model on the same unchanged inputs and record false positives and misses. Do not keep tuning against these photos and call them an independent benchmark.

Raw local outputs (ignored by Git): `test-results/three-site-photo-trial.json`, `test-results/three-site-photo-trial-neutral.json`. Original photos remain at user-supplied paths; no image copies committed.
