# Annual billing setup

Prices approved: Solo USD190/year, Pro USD390/year, Team USD790/year. Each is 10 times the monthly price. AI allowances refresh monthly (Solo 25 analyses / 25 Joe; Pro 75 / 100; Team 150 / 250). Packs remain non-expiring.

## Provider activation (still required)

Stripe: add an annual recurring Price to each existing tier Product. Do not replace monthly prices or migrate current subscribers. Set STRIPE_SOLO_ANNUAL_PRICE_ID, STRIPE_PRO_ANNUAL_PRICE_ID, STRIPE_TEAM_ANNUAL_PRICE_ID on Render after verifying currency USD, amount 19000/39000/79000, recurring year/count1, active live Price.

Google Play: separate subscription products contractorsight_solo_annual, contractorsight_pro_annual, contractorsight_team_annual, each with an auto-renewing annual base plan named annual. The Digital Goods checkout selects a product SKU, so keep a single backwards-compatible base plan per annual product. Set US prices 190/390/790; verify regions/localized prices before activating. Set GOOGLE_PLAY_SOLO_ANNUAL_PRODUCT_ID, GOOGLE_PLAY_PRO_ANNUAL_PRODUCT_ID, GOOGLE_PLAY_TEAM_ANNUAL_PRODUCT_ID. Confirm Android checkout shows the expected year, full annual charge, and renewal terms before any real purchase.

No new webhook subscriptions required. Existing Stripe invoice/refund/dispute and Google reconciliation flows apply. Annual options stay unavailable until configured; no existing subscriber is automatically changed. Changes are scheduled at renewal with no immediate charge.

## Entitlements

The credit ledger migrates non-destructively with a starts column, default0 for existing grants. Twelve non-overlapping calendar windows are persisted per annual payment. Future windows cannot be reserved or included in balances. Replays preserve usage. Refund/dispute reconciliation adjusts every window, including future windows. Annual cancellations retain paid monthly allowances through the paid term. Stripe seats require an active verified window. Google periods retain original expiry and start across restores and grace.

Before enabling, check Stripe tax registration/collection obligations; this change does not enable tax collection. Checkout verification currently expects exact catalog totals, so automatic tax, trials, discounts and prorations require separate implementation/testing.
