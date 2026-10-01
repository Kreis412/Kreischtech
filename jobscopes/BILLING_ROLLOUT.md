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

Deployment is held while the existing pilot is being tested. This work does not change current tester sign-in.
