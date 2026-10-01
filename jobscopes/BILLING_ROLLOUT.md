# Billing rollout

## Paid launch preparation — October 1, 2026

### Verified hosted refund test — October 1, 2026

Deployed commits 6fe5894 and cedfdca; full suite 93 passed before the final refresh-only change, then all 14 targeted billing tests passed. User saved the destination with 10 selected events. The existing $19 sandbox payment `pi_3ULqi5LNHFjZswsL0V98cFza` was fully refunded in Stripe test mode. On an ordinary page reload, before pressing Check test payment, ContractorSight showed **0 simulated analysis credits**, down from 20. This confirms automatic refund notification handling against Stripe's test service. The test subscription remains active; a refund does not itself cancel renewal. Pilot AI access is separate and was not changed. Screenshot: `contractorsight-refund-test.png` in the project mirror root. Real payment activation, customer terms/privacy review and private live credential setup remain outstanding.

User requested starting the real launch. Sandbox checkout was verified end-to-end: the signed payment notifications activated Solo and granted 20 simulated credits for the purchase made before the allowance change. Solo is now configured for $19/month and 25 analyses for subsequent grants. Real billing remains disabled.

Owner approved Solo-only website release ($19/month, 25 analyses plus 25 separate Joe answers) and $25 initial monthly AI funding. Crew, packs and Google Play remain later releases. Owner approved kreischtech@gmail.com as the public support, billing and refund contact; it is now linked in the billing and help screens. Set the same address in Stripe's public customer support details before live checkout opens.

Implemented opt-in live Solo billing, separate photo/Joe grants, server-bound consumption after saved results, one-seat enforcement and current-state refund/dispute reconciliation. Failed generation/validation/save returns customer credits; cached results bypass new reservations. A $25 UTC-calendar-month estimated provider meter covers paid calls and remaining pilot calls when live billing is configured. Unknown provider outcomes retain a conservative $3 hold. The 80% alert is a status flag, not an email notification. This is an application estimate, not a provider-enforced dollar guarantee; provider funding is separate. Tests mock provider calls; no real payments or AI spending were made.

Activation remains OFF. Remaining release work: verify the new invoice-payment/refund paths against Stripe sandbox, review customer terms/privacy and recovery procedure, then configure real Stripe credentials and live event destination privately. The public billing screen explains allowances, expiry, cancellation, refund contact and possible service pauses. Registration still uses the pilot invitation code: this is an invited launch, not open self-service signup. Existing pilot sign-in and access are preserved. Once a company starts live checkout it uses its paid ledger and cannot fall back to pilot AI after expiry or refund. Pending or abandoned checkout also reserves its one-seat status; support must review that case rather than creating duplicate paid orders.

Current official Astra standard rates checked: $10 per million input tokens and $50 per million output tokens. Source: https://developers.openai.com/api/docs/models/gpt-6-astra . These are token rates, not a guaranteed fixed price per photo. No additional AI calls or spending were authorized by this audit.

Current launch: USD $19/month Solo (1 user, 25 analyses, 25 Joe answers). Crew, packs and three-analysis trial remain proposals, not available in live mode. User has an existing Stripe account. No setup fee proposed.

### Live activation configuration — do not enable before release checks

- `STRIPE_LIVE_BILLING=1` explicitly selects live mode; leave absent while testing.
- `STRIPE_SECRET_KEY`: live secret entered privately in Render, never committed.
- `STRIPE_WEBHOOK_SECRET`: live destination signing secret entered privately.
- `STRIPE_SOLO_PRICE_ID`: separately created live USD $19 monthly price. Test IDs are rejected.
- `OPENAI_API_KEY`: existing server credential with separately funded provider account.
- `PILOT_REGISTRATION_CODE`: still required for invited account creation.

Live data is isolated in `DATA_DIR/stripe-live`; sandbox balances never purchase real AI. Live grants expire at invoice period end. Partial refunds reduce the original allowance proportionally, rounded down; usage history remains intact. Disputes freeze unused credits unless Stripe reports a win. Manual refunds are performed in Stripe, not automatically issued by ContractorSight. Charge/refund events arriving before fulfillment are handled by re-reading current payment state when granting. One charge cannot fund multiple invoice grants. Keep one running server instance with the existing persistent SQLite disk.

Both test and live destinations need all ten events listed below. API remains pinned to 2026-08-26.dahlia. Before activation also verify Stripe's public support address and statement descriptor, review terms/privacy, and perform the account owner's controlled live purchase/cancel check. Do not collect real customer payments merely because a deployment succeeds.

## Implemented locally

- Settings > Plan & usage shows the proposed catalog, explicitly unavailable to purchase.
- Authenticated read-only pricing endpoint; no browser can activate a plan or grant credits.
- Server-only SQLite credit ledger primitives: company isolation, grant deduplication, expiring buckets, transactional reservations, separate Joe/analysis types, one-time success/refund settlement, persistence across restart.
- Ledger is not connected to production AI requests or payment events yet. Existing pilot quota and tester access are unchanged. No live payments or additional API spending enabled.

## Required before accepting payment

1. Connect Stripe in test mode. Store credentials only in server environment settings. Determine the connected business and payout bank in Stripe; do not collect bank details in chat.
2. Create server-controlled prices; owner-only checkout and billing portal. Never trust prices/company IDs supplied by the browser.
3. Verify webhook signatures and paid invoice state. Bind provider customer/subscription to authenticated company. Deduplicate verified payment events using stable invoice or order IDs. Handle cancellation, failed renewal, refunds and out-of-order delivery.
4. Integrate credits around the full analysis lifecycle. Reserve before provider calls, complete after validated results are saved, refund customer credits on failed results. Retain provider cost records even when customer credits are refunded. Recover interrupted reservations deliberately; do not blindly retry uncertain provider calls.
5. Keep a separate installation spending guard. Purchased customer credits do not fund OpenAI automatically. Configure provider funding separately and measure actual costs before finalizing allowances.
6. Enforce seats, determine storage limits, pack expiry and Joe allowance, and publish those terms before checkout. Do not lock customers out of their existing data on downgrade.
7. Integrate Google Play billing and verified purchase handling for the Android app under applicable store rules. Website Stripe checkout alone does not complete Android billing.
8. Test sign-up, payment, renewal, duplicate delivery, failed payment, cancellation, company switching, refunds and restoration. Only then enable live billing and deploy with owner awareness.

## Stripe test integration — October 1, 2026

Implemented owner-only hosted Checkout, payment confirmation, a signed raw-body webhook endpoint, invoice-based renewal credits, scheduled test cancellation, and company-bound test balances. Stripe Node 23.0.0 is pinned with API version 2026-08-26.dahlia. All amounts and price IDs come from the server. Price amounts/type/currency are verified with Stripe before checkout. Repeated checkout requests reuse open sessions; uncertain requests retain their idempotency key. Invoice and session identities prevent double grants across restarts and event redelivery.

Test payments are intentionally isolated under `DATA_DIR/stripe-test/`. They do not grant real AI calls or change pilot seats. Test mode rejects live keys. Existing tester sign-in and the shared pilot AI spending guard remain unchanged. Live mode requires explicit separate activation as described above.

### Render setup

- `STRIPE_SECRET_KEY`: existing test secret, supplied privately by the owner in Render.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the test event destination below, supplied privately in Render.
- `STRIPE_TEST_BILLING=1`: enables sandbox checkout only when both test credentials are configured.

In Stripe test mode add a webhook event destination for **this account**:

`https://contractorsight-pilot.onrender.com/api/billing/webhook`

Select snapshot events, API version **2026-08-26.dahlia**, and these ten events. The handler uses event identities and retrieves current payment objects through the pinned REST API version above:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

The webhook signing secret starts with `whsec_`; it is different from the API key. Never commit either secret or paste it into chat.

Test price IDs verified from the user's Stripe dashboard:

- Solo: `price_1ULhyiLNHFjZswsLREk1wyW7`
- Crew: `price_1ULhzgLNHFjZswsLem7PSQsP`
- Pack: `price_1ULi17LNHFjZswsLkIg3xK4L`

### Acceptance test

Sign in as an owner, open Settings > Plan & usage, and choose a test checkout. Use Stripe test payment data only. On return choose Check test payment (also recovers a closed return page). Verify Solo gives 25 simulated credits, Crew 60, pack 10; repeats must not grant twice. One active subscription per company is supported; changes/prorations are rejected for manual review. Cancel a test subscription using the explicit cancellation control. Use Stripe test clocks/events for renewals and payment failures. Automated tests mock Stripe responses but use the real SDK signature verifier; real Stripe end-to-end acceptance is still required after configuring the event destination.



## Customer policies — October 1, 2026

Approved legal name: Kreischtech Contractors LLC, doing business as KreischTech.
Approved refund policy: full refund requested within 7 days of the first subscription payment; later requests individually reviewed; statutory rights preserved.
Public /terms.html, /privacy.html and /refunds.html are accessible before sign-in. Live checkout requires explicit versioned agreement and records owner/company/order/time in billing_consents. No existing login credentials change.
93 tests pass. Live credentials, live webhook and final live checkout verification remain pending. Test mode stays enabled until those are ready.
Refund handling: verify request/account/payment, refund through Stripe to original payment method, and cancel renewal if requested. A refund alone does not cancel renewal. Never request full card details or passwords over email.

## Live price correction — October 1, 2026
The original live price price_1ULhqDLNHFjZswsLhYh7UefI displayed $19/month but used tiers (price per unit: varies). Strict checkout correctly rejected it. Created replacement price_1ULs7mLNHFjZswsLmrhdCY0f on prod_VMQhgp32UY32v7: USD19, recurring monthly, flat rate with fixed unit price, no tiers. Updated Render STRIPE_SOLO_PRICE_ID; deploy dep-davdkm9srm7s73bjjssg pending verification. Original price retained, no existing subscriptions changed. No payment submitted.
Verified: corrected-price deploy succeeded; existing user-checked consent retained; retry opened live Stripe checkout showing USD19/month and approved 25+25 allowances. Payment form left empty for user; no charge submitted. Render AX setValue did not persist first edit; Playwright fill plus blur saved corrected price on second deploy.
