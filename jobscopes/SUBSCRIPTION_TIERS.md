# Subscription setup — October 21, 2026

| Plan | USD monthly | Company users | Photo analyses | Joe answers |
| --- | ---: | ---: | ---: | ---: |
| Solo | 19 | 1 | 25 | 25 |
| Pro | 39 | 1 | 75 | 100 |
| Team | 79 | 5 including owner | 150 shared | 250 shared |

Monthly allowances expire at the paid billing-period end. Purchased analysis packs carry over. Customer portal visitors do not consume user seats. Existing subscriptions are not automatically migrated; changing an existing subscription requires support to avoid duplicate billing.

## Production configuration

- Stripe Pro: `price_1UT35YLNHFjZswsLKFBVCCC3` (`prod_VU17lXuwz07iT9`).
- Stripe Team: `price_1UT36SLNHFjZswsLYFFPwUEh` (`prod_VU18GnL79jMzoL`).
- Existing Stripe Solo price configuration retained.
- Render `STRIPE_PRO_PRICE_ID` and `STRIPE_TEAM_PRICE_ID` saved.
- Render `GOOGLE_PLAY_SOLO_PRODUCT_ID=contractorsight_solo`, `GOOGLE_PLAY_PRO_PRODUCT_ID=contractorsight_pro`, `GOOGLE_PLAY_TEAM_PRODUCT_ID=contractorsight_team` saved and deployed.
- Google Play catalog confirms all three products have one active monthly base plan. Pro and Team shown backwards compatible; each product has only one base plan. US prices set exactly to 19.00, 39.00, 79.00. Other supported regions use Play-converted prices.
- Production commit `b4eda86` verified Live in Render; public billing module verified served over HTTPS.
- Service credentials were retained, not copied into this document.

## Verification and remaining acceptance

128 automated application tests passed, including duplicate delivery, restore, renewal, refund/revocation, expiry, separate Joe/photo balances and seat enforcement. Additional Google subscription API endpoint/acknowledgement checks passed.

A physical-phone Google Play checkout and completed purchase have NOT been observed. User asked to open Pro or Team checkout on the installed app and verify price, stopping before real payment. Do not claim a successful real purchase until one is verified. Website checkout and fulfillment for the new live prices have not been exercised with a real payment either.

The existing global AI spend cap remains unchanged ($25/month default). No new spend authorization or recurring monitoring was created. Reconciliation refreshes Play subscriptions during use/status checks; no real-time developer notification endpoint was added.

Project partial payments are separately deployed in `b0916d0` plus startup routing fix `adf8949`. Record payments through the project Payments tab; they share the company cash ledger, with an agreed total, balance, refund history, and idempotent saves.
