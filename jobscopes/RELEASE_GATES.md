# Release status — reviewed September 22, 2026

## Working local preview
- Company accounts, Owner/Manager/Viewer access, separate company databases.
- Persistent projects, photos, Discovery Log, materials/estimates and saved snapshots.
- Work items, milestones, crew assignments, approved labor, running costs and manager reports.
- Human decisions/overrides with reasons, evidence, revision checks and append-only history.
- Company reporting, statistics/charts, teal light/dark themes and settings.
- Ask Joe: experimental local text assistance, optional context, reviewed scope-note updates, opt-in lightweight reminders. No background inference.
- Experimental local photo analysis. Its three-scene accuracy trial FAILED the customer-release quality bar; software integration tests are not evidence of visual accuracy.

Baseline: 45 automated checks pass. Startup: `node server.mjs` or START_JOBSCOPES.bat, http://localhost:3200. No public deployment, services purchased or cloud AI integration performed.

## Outstanding private-beta gates
1. Site analysis quality: structured capture of intended scope/work stage, source-labeled facts and measurements, photo coverage, missing-evidence prompts; compare candidate models on unchanged cases and separately validate held-out residential/commercial cases. No claim of buildability or safety certification.
2. Hosting decision: verify current pricing and approve a proposal within the $50–$100 TOTAL startup budget. This is not authorization for recurring spend. Current Vercel marketing deployment does not host this stateful product server.
3. Hosted security: HTTPS/secure cookies, verified identity/recovery, secrets, project-scoped field/customer roles, independent security review. Viewer remains an internal office role with cash-report visibility.
4. Recovery: off-device backups and full accounts + companies + photos recovery test. Existing encrypted company export does not include the accounts database. Define retention, storage limits and monitoring.
5. Phone/computer: authenticated hosted synchronization, interrupted upload recovery, explicit offline/pending/synced status, real phone testing over an external network. Current localhost preview cannot provide this.
6. Estimating: explicit reviewed-finding-to-scope/material workflow, customer-ready quotes/change orders and approved-budget handling. Existing running costs reflect recorded data only.
7. Pilot readiness: acceptance tests with solo and multi-team samples, accessibility/speed, permission changes and isolation, error recovery, operating/support documentation. Public pricing and customer onboarding remain unbuilt.

Bank linking, billing, customer-facing chat, production-validated AI, resource forecasting and public release remain future work. Keep all existing human-review controls when changing AI providers.

September 22 update: Astra cloud photo pilot is connected and three corrected sample scenes passed a manual smoke review. See ASTRA_PILOT.md. Broader blinded evaluation, hosted credential handling, per-company billing quotas, resilient jobs and provider retention disclosures remain release gates. Equipment & Fleet inventory and manual maintenance tracking are implemented; GPS integration is not included.
