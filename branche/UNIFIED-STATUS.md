# Single-app integration checkpoint — November 11, 2026

Goal: one existing Android app, one origin, one account and session. Branche is
the community area; ContractorSight is the business toolset. No second account
or connection code for new users.

## Implemented in the opt-in local preview

- `createProduct({communityOptions:{}})` mounts Branche at `/community/` on the
  ContractorSight server. `BRANCHE_UNIFIED=1` enables it for the command-line server.
- ContractorSight owns authentication. Community sign-up/sign-in issue its
  existing HttpOnly session. Both areas immediately observe the same logout,
  expiry and membership revocation.
- New customers can create a business page on the same account.
- Existing billing and company storage retain their existing identities.
- Legacy profiles are adopted only through an existing owner-verified workspace
  mapping. Matching email addresses alone never authorize account merging.
- Original standalone deployments remain the default, unchanged.

## Not yet a production release

- Existing unlinked preview users can use Bring my existing Branche page after
  signing into the shared account. It verifies the previous password once, retains
  their original community ID, and refuses to replace populated accounts or steal
  a page already claimed by another account. Hosted migration still needs verification.
- Hosted community database and private media storage must be connected to the
  unified host. Do not start production with an empty local community database.
- Unified recovery and deletion currently direct to the existing ContractorSight
  support flow. Automated community deletion must not orphan shared identity or
  silently erase business projects. Finish shared-account lifecycle before launch.
- Desktop browser round-trip passed with a disposable local account. Mobile and
  hosted validation remain. Existing billing code is unchanged.
- Unified privacy/deletion wording and connection-settings navigation are updated.
- Render build must install dependencies in both jobscopes and branche. Current
  command is npm ci && node --test from jobscopes; required new command is
  npm ci && npm ci --prefix ../branche && node --test.
- Render access is available. Neon SSO is blocked on user email verification.
  Its Vercel connection-secret controls are disabled, and connector env reads
  deliberately omit the sensitive DATABASE_URL. No credentials have been changed.
- No production push, database migration, Google Play upload or public launch has
  been performed for this integration.

## Restore points

Original ContractorSight code: tag
`contractorsight-before-ohio-marketplace-2026-11-10` and workspace ZIP.
Before this change: commit `476d449f7c26ed3380824a29174abb024a8fffeb`, plus
`../backups/branche-before-single-signin-2026-11-11.bundle`.
These are source backups, not a verified production customer-data backup.

## Validation

Run `node --test branche/test/*.test.mjs jobscopes/test/accounts.test.mjs` from
the repository root. Tests use temporary databases and local servers, not live
customers. Includes shared-session registration, cross-area access and logout,
account isolation, customer-to-business role change, static asset routing and
existing community/account access-control regressions.

November 11 verification: 15 targeted account/community tests passed; full
jobscopes test suite passed. Browser verified Branche -> ContractorSight ->
Branche with one login. Screenshots saved in the workspace root.
