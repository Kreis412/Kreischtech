# Branche private Ohio test

Isolated from ContractorSight. Node 22+, `npm ci`, then `npm start`.
Local URL: http://127.0.0.1:4179. Local SQLite data stays under ignored data/.
Run `npm test` for the account, profile, job, messaging, blocking, reporting,
authorization and persistence workflow checks.

Vercel project: branche-test; root directory: branche. Connect a dedicated
Postgres DATABASE_URL in Vercel; never commit credentials. Hosted startup
fails closed without that database. Only feature/ohio-marketplace contains
this prototype; do not replace the existing ContractorSight deployment.

Private-test limitations: no email verification, password recovery, automated
moderation, license verification, payments, reviews or photo gallery yet.
Reports are saved in branche_reports with pending status; an operator must
review them. Do not invite the general public before moderation, recovery,
account deletion and a full privacy/retention process are in place.
Example requests are visibly labelled and are not real leads.

## ContractorSight connection (first integration stage)
Contractors can open `#workspace` in Branche and paste a one-use code generated
by their existing ContractorSight Owner account at `#settings/branche`.
Codes expire after ten minutes, are stored hashed, and are consumed once.
Redemption rechecks Owner access. Matching email addresses never links accounts.
Each ContractorSight company can link to one Branche account. Disconnecting
removes only the mapping and never cancels billing or deletes a workspace.
The fixed server-to-server destination is contractorsight-pilot.onrender.com;
callers cannot supply an arbitrary endpoint.

Current scope: business identity and an Open workspace button. Sign-ins remain
separate. This is not SSO and does not import messages, projects or invoices.
Inquiry-to-project conversion and shared sign-in are subsequent work.
Both apps must be deployed before the connection flow can be used.

## Media and launch readiness (2026-11-10)
- Private Vercel Blob storage: uploaded JPEG/PNG/WebP is decoded, resized, re-encoded as WebP, and stripped of metadata. Public read access requires attachment to a currently published page/post; unpublished and unattached images are owner-only.
- Six gallery images per page/post, one business logo, safe HTTPS website link and YouTube link. Videos open YouTube; no video file upload yet.
- User image library includes unused-image deletion; currently capped at 30 images per account and 20 uploads per day.
- Hosted upload, linking, image retrieval, ownership and cleanup were verified against the private preview.
- Recovery code is prepared. Configure BRANCHE_GMAIL_APP_PASSWORD securely in Vercel and BRANCHE_PUBLIC_URL as the canonical HTTPS app URL. Mail sends from kreischtech@gmail.com. Never commit the app password.
- Before public release: verify Gmail delivery and password reset end-to-end, configure BRANCHE_ADMIN_IDS with the verified owner account ID, verify the operator moderation queue and account deletion on the hosted database, review the privacy/retention notice, and remove preview-only wording only when ready. Do not simply remove Vercel protection.
- Branche remains separate from ContractorSight authentication and billing.

Operator moderation and password-confirmed account deletion are implemented. Admin access is denied unless BRANCHE_ADMIN_IDS explicitly contains the signed-in account ID. Do not infer operator access from a public business name or unverified email.
