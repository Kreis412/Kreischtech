# Architecture and repository inspection

## Repository findings

Source: Kreis412/Kreischtech, default branch master, described as AI Consulting Website. The existing product landing page markets AgentOS. React + TypeScript + Vite, static Vercel deployment. There was no JobScopes application backend in this repository. This work is on local branch `jobscopes/company-foundation`; it does not replace the website or Vercel configuration.

## Layers

- Marketing site: existing `src/` and root `public/`, unchanged.
- Product gateway: `jobscopes/server.mjs` checks local request boundaries, resolves authenticated identity, enforces roles, then dispatches to the selected workspace.
- Identity/access: `accounts.mjs`, a dedicated accounts database containing users, companies, memberships, hashed sessions/invitations, throttling and limited access-event history.
- Workspace domain: `workspace.mjs`, materials and company modules. Private workspace instances are keyed only by company UUID resolved from the account session. Clients cannot choose a storage path.
- Company storage: `data/companies/<server-generated-company-id>/contractoros.sqlite`. Separating databases prevents accidental missing company filters in existing domain queries. Records and photo bytes remain transactional within a company.
- Browser: existing responsive teal UI, now with account and team screens. No privileged token is stored in localStorage; localStorage is used for appearance only.

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
