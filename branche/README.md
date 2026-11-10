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
