# Architecture and repository inspection

## Repository findings

Source: Kreis412/Kreischtech, default branch master, described as AI Consulting Website. The existing product landing page markets AgentOS. React + TypeScript + Vite, static Vercel deployment. There was no ContractorSight application backend in this repository. This work is on local branch `jobscopes/company-foundation`; it does not replace the website or Vercel configuration.

## Layers

- Marketing site: existing `src/` and root `public/`, unchanged.
- Product gateway: `jobscopes/server.mjs` checks local request boundaries, resolves authenticated identity, enforces roles, then dispatches to the selected workspace.
- Identity/access: `accounts.mjs`, a dedicated accounts database containing users, companies, memberships, hashed sessions/invitations, throttling and limited access-event history.
- Workspace domain: `workspace.mjs`, materials and company modules. Private workspace instances are keyed only by company UUID resolved from the account session. Clients cannot choose a storage path.
- Company storage: `data/companies/<server-generated-company-id>/contractoros.sqlite`. Separating databases prevents accidental missing company filters in existing domain queries. Records and photo bytes remain transactional within a company.
- Browser: existing responsive teal UI, now with account and team screens. No privileged token is stored in localStorage; localStorage is used for appearance and optional assistant-reminder preferences only.

## Security decisions

Deny unauthenticated access to all data routes, including original image URLs. Apply role checks before delegating any mutation, and owner checks before backup export. Validate membership on every request rather than copying the role into a long-lived browser token. Rotate opaque sessions on sign-in/company switch. Changing membership invalidates related sessions. Protect local browser requests using strict origin/Host checks, SameSite cookies and CSP.

Authentication and invitations are deliberately local-preview-only. Email ownership is not verified; therefore no customer onboarding or public signup is enabled on the internet. User-supplied names and values remain escaped in HTML. Invitations grant access to an entire company and the UI says so.

Reference guidance reviewed during implementation:
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Scale without pretending it is already proven

Companies, memberships and jobs are separate concepts. Multiple owners' businesses and multiple projects are tested; no single-contractor assumption is built into session routing. Current persistence is single-host SQLite with one active connection per accessed company. No distributed deployment, enterprise load benchmark or unlimited-scale guarantee is claimed. Company-sharded routing can later use a hosted persistence adapter; job, finding and membership identities need not change.

Before hosting, choose a persistent backend/database and storage strategy, external or managed identity, cross-device synchronization, storage limits and tested operational recovery. Vercel's current static build does not automatically host this stateful server. The initial budget is $50–$100 total before revenue, not an approved recurring spend. No services have been bought or provisioned.

## Product direction preserved

Your expertise. Less busywork. More time to build. Photo analysis flags concerns with evidence and uncertainty; it never certifies suitability or removes professional/human review. Residential and deck evidence workflows first, with commercial analysis separately validated. Company-wide reporting, project managers, schedules and recovery planning are core product goals for businesses of all sizes. The owner's basement is a test case, not the product's market boundary.

### Project operations
`operations.mjs` persists reviewed findings, linked work, crew assignments, time approvals and manager reports per company SQLite database. The gateway passes actor identity from the authenticated session. Approved labor freezes rate/burden and permits void corrections only. Operations responses redact rate/cost fields for Viewers. This does not make the Viewer role customer-safe: existing cash reporting remains accessible.
Production-validated image interpretation, payroll, time-clock capture, task dependencies, resource capacity forecasts, and hosted phone synchronization are not implemented. Current schedule indicators use overdue/blocked tasks and report freshness. Cost comparison uses latest estimate snapshot, not a controlled contract budget. Public release gates remain unchanged.

### Experimental local image analysis
`analysis.mjs` calls fixed localhost Ollama using `gemma3:4b`. It stores per-photo run metadata in `photo_analyses` and atomically creates unreviewed operations findings. Source/model/run provenance survives human edits. No model output can directly create tasks, approve findings or alter estimates. The provider receives only selected image bytes and explicitly entered context; all model strings are escaped in the UI. Results are deduplicated by project/photo/model. This prototype has no rerun/version-selection UI, no cloud fallback, and no quality certification. Real-image observations in README document substantial quality limitations.

### Joe and documented decisions
`joe.mjs` stores user-separated chat exchanges per company and optionally supplies bounded project context. A shared local-model lock limits concurrent photo/chat inference; completed requests unload the model. Suggestions are opt-in browser reminders, with no background inference. Draft notes require explicit human editing/saving through existing project authorization and revision checks. `decisions.mjs` preserves finding/decision snapshots and invalidates prior decisions after finding revisions; history is append-only in the app/database, not tamper-proof against a filesystem administrator.
