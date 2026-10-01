# Billing rollout

Approved direction: USD $19/month Solo (1 user, 20 analyses), $39/month Crew (up to 5 users, 60 analyses), $10 for 10 pay-as-you-go analyses, proposed trial 3 analyses. User has an existing Stripe account. Prices/allowances remain launch proposals pending measured AI costs. No setup fee proposed. Joe needs a separate bounded allowance; its amount is not yet decided.

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

Implemented owner-only hosted Checkout, payment confirmation, a signed raw-body webhook endpoint, invoice-based renewal credits, scheduled test cancellation, and company-bound test balances. Stripe Node 23.0.0 is pinned with API version 2026-09-30.endive. All amounts and price IDs come from the server. Price amounts/type/currency are verified with Stripe before checkout. Repeated checkout requests reuse open sessions; uncertain requests retain their idempotency key. Invoice and session identities prevent double grants across restarts and event redelivery.

Test payments are intentionally isolated under `DATA_DIR/stripe-test/`. They do not grant real AI calls or change pilot seats. No live key is accepted. Existing tester sign-in and the shared pilot AI spending guard remain unchanged. Refund/dispute handling, real credit consumption/seat enforcement, final allowances and live purchase activation remain release blockers.

### Render setup

- `STRIPE_SECRET_KEY`: existing test secret, supplied privately by the owner in Render.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the test event destination below, supplied privately in Render.
- `STRIPE_TEST_BILLING=1`: enables sandbox checkout only when both test credentials are configured.

In Stripe test mode add a webhook event destination for **this account**:

`https://contractorsight-pilot.onrender.com/api/billing/webhook`

Select snapshot events, API version **2026-08-26.dahlia** (available in the Stripe dashboard), and these six events. The handler uses event identities and retrieves current payment objects through the pinned REST API version above:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The webhook signing secret starts with `whsec_`; it is different from the API key. Never commit either secret or paste it into chat.

Test price IDs verified from the user's Stripe dashboard:

- Solo: `price_1ULhyiLNHFjZswsLREk1wyW7`
- Crew: `price_1ULhzgLNHFjZswsLem7PSQsP`
- Pack: `price_1ULi17LNHFjZswsLkIg3xK4L`

### Acceptance test

Sign in as an owner, open Settings > Plan & usage, and choose a test checkout. Use Stripe test payment data only. On return choose Check test payment (also recovers a closed return page). Verify Solo gives 20 simulated credits, Crew 60, pack 10; repeats must not grant twice. One active subscription per company is supported; changes/prorations are rejected for manual review. Cancel a test subscription using the explicit cancellation control. Use Stripe test clocks/events for renewals and payment failures. Automated tests mock Stripe responses but use the real SDK signature verifier; real Stripe end-to-end acceptance is still required after configuring the event destination.
