# ContractorSight Connect invoicing

## Deployment status

Implemented on `feature/connect-invoicing`, based on deployment branch
`jobscopes/company-foundation`. The existing Render service uses root `jobscopes`,
`npm ci && node --test`, `node server.mjs`, and a persistent disk at `/var/data`.
Auto-deploy is documented as off. Deployment has not been performed by this change.

The Android app (`com.kreischtech.contractorsight`, version 0.1.3 / code 4) is a
Trusted Web Activity opening `https://contractorsight-pilot.onrender.com/`.
This server/web change needs no new Android bundle. Test the hosted Stripe round trip
on a Play-installed phone before release. Google Play credentials are unrelated to Connect.

## Isolation from existing payments

- Do not change `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIVE_BILLING`,
  `STRIPE_TEST_BILLING`, price IDs, Google Play settings, or existing webhook destinations.
- `/api/billing/webhook` continues processing platform subscriptions and one-time packs.
- Connect uses its own Stripe client, API key, webhook secrets, SQLite file and routes.
- Existing recorded deposits/progress payments/refunds remain available if Stripe is down.
- Connect invoice status is synchronized in its own ledger. It does not automatically add
  cash entries or platform credits, so it cannot double-count an existing recorded receipt.
- No transfers, payout changes, destination charges, or application/platform transaction fees.
  Stripe processing and Invoicing fees still apply to the contractor's connected account.

## Sandbox configuration first

Use the connected **Kreischtech Contractors LLC sandbox** (`acct_1RjFysPonNjanWsw`).
Never put keys in the browser, Android project, source repository, screenshots or chat.
Use Render's private environment settings (or its supported secret store):

| Variable | Value |
| --- | --- |
| `STRIPE_CONNECT_ENABLED` | `1` only on the sandbox deployment after configuration |
| `STRIPE_CONNECT_MODE` | `sandbox` |
| `STRIPE_CONNECT_SECRET_KEY` | Dedicated sandbox restricted key (`rk_test_...` preferred) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secret for the sandbox connected-account invoice destination |
| `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET` | Signing secret for sandbox Accounts v2 events |
| `STRIPE_CONNECT_ALLOW_LIVE` | Unset; keep live actions disabled |
| `PUBLIC_ORIGIN` | Exact HTTPS origin of that deployment |
| `DATA_DIR` | Persistent disk location; retain backups and one server instance |

Grant the dedicated restricted key only the operations needed for Accounts v2
creation/read, Account Links creation, connected-account Customers create/read,
Invoices create/read/finalize/send, and Invoice Items create/read. Accounts v2 creation
requires `v2_account_storer_write`. Validate connected-account access permissions and
each API operation in sandbox; do not give this key payout/transfer permissions.
The Stripe connector's account connection does not supply a runtime key to Render.

## Dashboard steps

1. Open the sandbox in Stripe, then Connect. Confirm the platform onboarding/profile
   is complete and Accounts v2 is enabled if Stripe requests it. Choose a SaaS platform:
   full Stripe Dashboard, Stripe collects its fees, Stripe owns negative balance losses,
   direct charges. Account onboarding is Stripe-hosted. The application hard-codes this
   configuration and requests merchant card payments.
2. In sandbox Workbench/Webhooks, create a destination receiving **connected-account**
   snapshot events at `https://YOUR-SANDBOX-HOST/api/connect/webhook` with:
   `invoice.created`, `invoice.updated`, `invoice.finalized`, `invoice.sent`, `invoice.paid`,
   `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`, `invoice.deleted`,
   `account.updated`, and `account.application.deauthorized`.
3. Add an Accounts v2 thin-event destination at
   `https://YOUR-SANDBOX-HOST/api/connect/accounts-webhook` for merchant capability status
   and account requirements changes (for example
   `v2.core.account[configuration.merchant].capability_status_updated` and
   `v2.core.account[requirements].updated`). Use its distinct signing secret.
   Check that these events include a `related_object.id` for the connected account;
   the server retrieves current account state rather than trusting event metadata.
4. Add the private settings above and deploy the feature to a sandbox/staging service
   with a separate data directory. Do not change production billing settings.
5. Sign in as a company owner; open `/invoicing.html`, select Set up Stripe payments,
   finish Stripe's sandbox onboarding, and return. A return URL alone never marks
   onboarding complete. The server retrieves the merchant capability before invoicing.
6. Create a test project/customer invoice, inspect its draft items and total, finalize,
   share the Stripe URL, and use Stripe's test payment details. Send only to a controlled
   test mailbox. Verify `invoice.paid` delivery and refreshed paid status, retry deliveries,
   failed payment/open/void/uncollectible status, and isolation from a second company.
7. Review pricing/fees and connected-account email branding in Stripe. Link full Dashboard
   access for account management, refunds, disputes and payouts. An embedded Notification
   Banner is a useful future addition; this release uses hosted onboarding and Dashboard.

Read-only checks on October 24, 2026: the live Kreischtech account has charges/payouts
enabled, and its connected-account list is empty. The sandbox has one existing active
test connected account (`acct_1UTzIOPonNsqBt5p`) with full Dashboard and Stripe-managed
losses; this integration does not adopt it or change it. The sandbox platform's own
v1 status reports `requirements.pending_verification`. Accounts v2 reads and account
creation are not authorized through the present connector permissions, so app-driven
onboarding and real Stripe end-to-end tests remain unverified until runtime credentials
and dashboard readiness are configured. Do not equate these API checks with live launch approval.

## Operation and recovery

Owners create/onboard/finalize/send; managers may view; other roles cannot access invoices.
Company/account/project relationships come from server sessions and saved mappings,
never client account IDs. Customers and all invoice API calls use the connected account.
Drafts exclude pending items and disable automatic advancement. Finalize creates the
hosted payment URL; Send is a separate explicit action. All invoice amounts are USD cents.

An interrupted draft retains its immutable payload and Stripe idempotency keys. Retry the
same request or use Resume unfinished draft in history after reloading. Unresolved requests
older than 23 hours stop for manual reconciliation before Stripe can prune their keys.
Do not delete their SQLite rows or create replacements until checking Stripe for existing
objects. Finalized/sent/paid invoices use their existing IDs and do not recreate payments.

Both webhook endpoints verify raw-body signatures and environments. Account mappings,
invoice IDs, customer IDs, metadata and current Stripe invoice data must agree. Event IDs
are persisted for deduplication; API failures return an error so Stripe can retry. Events
without a connected account cannot affect the Connect invoice ledger. Account
deauthorization blocks future actions until operator review.

Live enablement requires separate explicit owner consent and successful sandbox checks;
only then configure dedicated live Connect credentials and `STRIPE_CONNECT_ALLOW_LIVE=1`.
Do not alter live payouts or send live invoices as part of sandbox setup.

Reference: [Stripe SaaS account configuration](https://docs.stripe.com/connect/saas/tasks/create),
[hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding),
[webhook verification](https://docs.stripe.com/webhooks),
[restricted keys](https://docs.stripe.com/keys).
