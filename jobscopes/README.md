# JobScopes — company foundation preview

This product lives separately from KreischTech's existing React marketing site. It reuses the tested local project/photo/discovery/estimate/statistics UI and storage modules, with an authenticated company gateway in front. The live site and the original ContractorOS data have not been changed.

## Start

Requires Node.js 22.14 or newer. No dependency installation, API keys, subscription or payment is needed.

From this directory:

```powershell
node server.mjs
```

Open http://localhost:3200. Choose **Create a company account**, enter your own email, name, company and a password of at least 16 characters. This is a local preview; email addresses are not verified and no messages are sent. Password recovery is not yet available. Do not reuse a password from another service.

Alternatively, double-click START_JOBSCOPES.bat. Keep its window open. Stop with Ctrl+C. Data survives restarts in the ignored `data` directory.

The original app at port 3100 is separate. Its customer records/photos were intentionally not copied into this public repository or this new preview. A reviewed import is a later task.

## Workflows delivered

- Account registration and sign-in, server-side sessions, sign-out and expiry.
- Company creation and switching, including multiple companies per person.
- Owner, Manager and Viewer office roles. Permissions are enforced on the server.
- Owners create email-bound invitation codes. Codes last 48 hours and work once. Share them yourself; no email is sent by the app. An invitee first creates an account/company, then uses **Settings → Company & team → Accept an invitation** and switches to the invited company.
- Owners can change Manager/Viewer access or remove a membership. Changes invalidate sessions for that membership immediately; removal also invalidates outstanding invitations for that email/company.
- Each company has isolated projects, photos, discoveries, materials/estimates, cash records and statistics. The gateway derives the company from the session, not a query parameter/header/body.
- Owners alone can export the selected company's encrypted backup. It is a workspace snapshot, not an accounts-system backup.

| Capability | Owner | Manager | Viewer |
|---|---|---|---|
| Read all company jobs, photos, estimates, finances | Yes | Yes | Yes |
| Edit jobs, discoveries, estimates, money | Yes | Yes | No |
| Invite/change/remove company members | Yes | No | No |
| Export company backup | Yes | No | No |

These are office roles. Do not invite customers or restricted field crews as Viewers: Viewers can read financial records. Project-scoped field/customer permissions remain a release gate. The existing Security page reflects sign-in status and backup permission.

## Checks

```powershell
node --test
```

33 tests pass (parent tests included). New integration scenarios cover anonymous rejection; company ID spoofing; cross-company project/photo/estimate access; isolated money totals; invitation email binding and replay; read-only enforcement; session revocation after role changes; manager edits; expired sessions; sign-out; persistence and 15 simultaneous sample projects. Existing project/photo/material/finance/backup checks are retained.

Browser checks used `test-results/browser` only: company registration, invitation form/code generation, second-company creation, company switching and logout; 390px mobile layout has no horizontal page overflow. An initial frontend initialization error was found and corrected. Test accounts are fictional and are not in the default data directory.

## Not a hosted or launch-ready release

The server deliberately binds to localhost and rejects LAN, unexpected Host values, proxy forwarding and cross-origin requests. This edition cannot be deployed as the existing Vercel static site: it requires a persistent Node process and durable storage. Do not expose it using a tunnel or bypass its local guard. No phone-away-from-home access is enabled yet.

Local sessions use HttpOnly, SameSite=Strict cookies with an eight-hour server-enforced expiry. Secure cookies/HTTPS are mandatory before deployment. Passwords use scrypt with unique random salts; session and invitation tokens are stored as SHA-256 hashes, not plaintext. Login/registration attempts are rate limited in persistent storage. This is a tested implementation, not a security certification or external audit.

Account recovery, verified email, MFA, complete audit trails, hosted storage encryption, automatic off-device backups, upload quotas, independent security review and cross-device/offline synchronization are still required for launch. Automated photo analysis, milestones, project-manager reports and recovery suggestions are not yet implemented. Human review remains a product requirement.

Keep `data/accounts.sqlite` and company databases private. For a complete local disaster-recovery copy, stop the server and protect a copy of the entire data directory; live local files are not encrypted by this app. Company exports alone do not restore user identities or memberships. The restore utility works only with a new directory and never overwrites existing data.

See ARCHITECTURE.md and RELEASE_GATES.md for the next steps and budget constraints.

### Marketing-site checks

The existing TypeScript check and Vite production build pass. The existing four website tests fail because they still expect KaiAI branding, old consulting prices and a Data Security link while the current homepage markets AgentOS. The website source and those tests were not changed. The Vitest configuration now limits discovery to src so it does not accidentally run the separate Node integration suite. This pre-existing website test debt remains before a marketing refresh.

## Navigation and financial language update

Company now shows a company-wide project register, status totals and financial activity. Statistics contains the bar and pie charts; Company has a View charts link. Empty charts display clearly labeled no-data states, not invented transactions. Financial actions use Record transaction, Cash receipts, Cash disbursements, Net cash flow, Expense breakdown and Transaction ledger.

Settings groups Company & team, Appearance, and Security & backups. The top-right Dark mode button shows its current state; Appearance provides the same saved preference. Old #team and #security links redirect to their Settings sections. Browser checks covered navigation, security access, old links, empty charts, theme persistence and the 390px layout without horizontal page overflow or console errors.

## Connected project workspace (September 20, 2026)

Open a project and use **Project workspace**:
1. Upload evidence in **Site photos**. In **Site review**, record observations, uncertainty, verification steps and review notes. This is human-guided review; automated image analysis is not connected.
2. Confirm a finding to create its linked work item. Assign tasks/milestones, due dates and blockers. Existing Discovery Log records remain available separately.
3. Add company crew members with internal hourly cost rates and optional additional burden, then assign them to projects. Crew records are not login accounts.
4. Record minutes worked. Pending time contributes no cost; approval freezes the current rate and burden. Approved entries can only be voided with a reason, then corrected with a new entry.
5. Record project expenses. Known job cost is approved labor plus non-Labor recorded expenses less supplier refunds. Labor-category ledger payments are excluded to avoid duplicate payroll/time costs. Record all employee labor through time entries. Commitments, unrecorded expenses and forecasts are not included.
6. Save an estimate snapshot for cost comparison. This uses the latest snapshot cost, not selling price or an approved contract budget. Unresolved estimate gaps remain flagged.
7. Add manager progress reports. Company overview shows schedule indicators, manager, open work, last report and known costs across projects. These indicators describe entered records; they do not guarantee schedule performance.

Owner and Manager roles can manage operations and view internal rates/costs. Viewers receive redacted operational cost fields and cannot edit. Existing company cash reporting remains visible to Viewers; this is an internal office role, not customer access.

Start using `START_JOBSCOPES.bat` in this folder, or `node server.mjs`, then open http://localhost:3200. The authenticated preview remains local-only. Tests: `node --test` (39 passing). An isolated browser test verified finding-to-task creation, crew assignment, approved labor cost, and phone-size layout. Real company data was not seeded with test entries.
