# Google Play analysis packs — rollout checkpoint

Prepared 2026-10-16. Not yet enabled for customers.

Products already active in Play Console: analysis_1 ($0.99 / 1), analysis_5 ($4.99 / 5), analysis_12 ($10.99 / 12). Verify local prices from Play on the phone. Credits carry over until used; Joe allowance is separate.

## Required server connection

1. In a Google Cloud project owned by KreischTech, enable Google Play Android Developer API.
2. Create a dedicated service account, e.g. contractorsight-play-billing. Do not grant broad Cloud project roles.
3. In Play Console Users and permissions, invite that service account email with access only to ContractorSight and the permissions required to view purchase/financial data and manage orders. Review permissions before granting; no release-management permission is needed for receipt verification.
4. Create its JSON key and enter the complete JSON **directly** into Render's secret environment variable GOOGLE_PLAY_SERVICE_ACCOUNT_JSON. Do not paste into chat, source code, or Git.
5. Set GOOGLE_PLAY_BILLING=1 only when the key is saved and permissions are ready. Set GOOGLE_PLAY_ALLOW_TEST=1 for Google's license-tester purchases; leave it unset for live-only operation.

Server uses fixed package com.kreischtech.contractorsight, server-verified receipts, owner-only claims, unique durable token binding, grant-before-consume recovery, and the existing live credit ledger. Tokens are held in the private persistent data directory, never returned to another account or logged. Refund status is checked on Check purchases and before paid analysis when more than 15 minutes since the last check. This is on-demand reconciliation, not a background notification service.

## Android and phone checks

Prepared signed bundle: android/app/build/outputs/bundle/release/contractorsight-0.1.3.aab, version code 4. Android Browser Helper billing 1.2.0 connects Chrome Digital Goods / Payment Request to Google Play. Build and lint pass. This bundle has NOT been uploaded in this step.

Upload to internal testing first. Use a Play license tester signed into the same Google account in the Play Store. On the phone: open Plan & usage, check localized prices, buy each test pack, verify balance increments 1/5/12, close/reopen and check persistence, repeat a purchase, cancel checkout, and test Check purchases after an interrupted verification. Use Google's test payment method, not a real card. Verify refund removes only that purchase's remaining entitlement. Do not promote until device checks pass.

Local automated coverage includes receipt deduplication/restart, cross-account denial, pending/canceled/test receipt rejection, consume retry, refunds, carryover, failed-analysis credit return, payment UI recovery, server OAuth request signing, plus existing Stripe/login checks. Automated mocks do not replace a real Play phone checkout.

Reference: https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing
API setup: https://developers.google.com/android-publisher/getting_started
