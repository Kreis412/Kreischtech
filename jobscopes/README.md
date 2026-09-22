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
1. Upload evidence in **Site photos**. In **Site review**, record observations, uncertainty, verification steps and review notes. Experimental local photo analysis is available through Ollama; human review is required.
2. Confirm a finding to create its linked work item. Assign tasks/milestones, due dates and blockers. Existing Discovery Log records remain available separately.
3. Add company crew members with internal hourly cost rates and optional additional burden, then assign them to projects. Crew records are not login accounts.
4. Record minutes worked. Pending time contributes no cost; approval freezes the current rate and burden. Approved entries can only be voided with a reason, then corrected with a new entry.
5. Record project expenses. Known job cost is approved labor plus non-Labor recorded expenses less supplier refunds. Labor-category ledger payments are excluded to avoid duplicate payroll/time costs. Record all employee labor through time entries. Commitments, unrecorded expenses and forecasts are not included.
6. Save an estimate snapshot for cost comparison. This uses the latest snapshot cost, not selling price or an approved contract budget. Unresolved estimate gaps remain flagged.
7. Add manager progress reports. Company overview shows schedule indicators, manager, open work, last report and known costs across projects. These indicators describe entered records; they do not guarantee schedule performance.

Owner and Manager roles can manage operations and view internal rates/costs. Viewers receive redacted operational cost fields and cannot edit. Existing company cash reporting remains visible to Viewers; this is an internal office role, not customer access.

Start using `START_JOBSCOPES.bat` in this folder, or `node server.mjs`, then open http://localhost:3200. The authenticated preview remains local-only. Tests: `node --test` (39 passing). An isolated browser test verified finding-to-task creation, crew assignment, approved labor cost, and phone-size layout. Real company data was not seeded with test entries.

## Experimental local photo analysis — no cloud API credits

Prerequisites: Ollama running on this computer, with the already-installed `gemma3:4b` vision model. No downloads, Google requests, subscriptions or paid APIs were used in this milestone. Local computation uses the laptop's memory/GPU/electricity.

Open a project → Site photos → upload a photo → Project workspace → **Analyze photo locally**. Choose a photo and optionally supply the intended work and known facts. Analysis saves draft findings marked **Needs review**, with model and photo provenance. Review/edit/dismiss each draft before confirming it or creating work. The model may confuse supplied facts with image observations; verify measurements yourself. Existing manual Discovery Log records are unchanged.

Implementation sends only the selected image and the entered context to fixed loopback `127.0.0.1:11434`; no project finances, addresses, account secrets or other photos are included automatically. It checks model vision capability, rejects advertised cloud routing, prevents HTTP redirects, requests schema-constrained output, and validates every draft before a single transaction saves the result. Requests are limited to one analysis at a time in this server, with a three-minute timeout and `keep_alive: 0` to unload after generation. Owner/Manager only. The model name is fixed for this trial; no auto-download or cloud fallback. Repeating the same photo returns its saved result, regardless of changed context; edit the resulting findings rather than rerunning it in this milestone.

Validation: 42 automated tests pass. Three local trials on the user's supplied basement image took approximately 9–16 seconds on this laptop. The first was poor (clutter emphasis and speculative damage); revised instructions improved relevance, but the model still missed low ductwork and used ambiguous construction/acoustic wording. This is NOT a release-quality validation or evidence of reliable commercial site assessment. No findings from these trials were inserted into the user's actual project; browser/API trials used the separate ignored test workspace. Automated photo analysis requires a labeled evaluation set and a quality gate before public release.

Gemini CLI was found installed but not invoked or connected. A future cloud comparison needs separate review of account quota, data handling and deployment suitability. Official API references: https://docs.ollama.com/api/chat and https://docs.ollama.com/capabilities/structured-outputs

## Human decisions and overrides
Each site finding now has **Record decision**:
- Proceed: reason required; authorizes linked work without changing observation status or certifying safety.
- Resolved: reason plus written resolution evidence or a project photo required.
- Deferred: reason, responsible person and today/future review date required. Due reviews appear in suggested actions.
- Specialist review: records the request; does not contact anyone automatically.
- Reopened: withdraws prior work authorization pending a new decision.

Owners/Managers decide; Viewers can read history only. A current Proceed or Resolved decision allows work from an otherwise unconfirmed finding. Deferred, Specialist review and Reopened decisions hold linked work; explicit task blockers remain in force. Existing confirmed findings without decisions retain their prior behavior. Revising a finding invalidates its earlier decision; record a new decision after reviewing the change. Completed tasks are not silently reopened.

History records original/revised finding snapshots, authenticated actor identity/role, timestamps, reasons and evidence. Records cannot be edited or deleted through the application; SQLite triggers enforce append-only rows. This is not tamper-proof storage against someone controlling the local database/files. Existing pre-feature findings gain their baseline snapshot on their next edit/decision; earlier overwritten versions cannot be reconstructed. Backups include the history table.

Validation: 43 automated tests passing, including stale decisions, role checks, evidence ownership, work authorization, finding changes and append-only enforcement. Browser test performed only in the isolated test company.

## Ask Joe — construction assistant preview

**Ask Joe** is a dedicated page for residential/commercial planning, estimating checklists, sequencing, crew questions and general help. Uses installed `llama3.1:8b` through local Ollama; no paid service or downloads. This is construction-focused prompting, not a certified expert model or a current code database. Joe has no web access, cannot inspect photos in chat, and can be wrong.

- General or project conversation; the latest 12 exchanges are displayed and up to 3 recent exchanges provide conversational context.
- Project context is opt-in. Includes bounded project scope/notes, latest findings/decisions and work items. No financial tables, crew rates, account credentials, photo bytes, client/address fields are automatically included. User-entered notes may contain private data. Switching context off excludes previous exchanges that used project context.
- History is separated by authenticated user inside each company database. Owners' database backups include all chats; history is not confidential from database administrators.
- Owners/Managers can **Review as project notes**, edit the draft, and explicitly **Save notes**. Only Scope & notes changes, with normal revision conflict protection. No automatic project edits, cost changes, approvals or external actions. Viewers may chat but cannot apply edits.
- **Settings → Joe assistant** enables optional site-wide reminders (off by default). They are local page-based suggestions, not AI-generated scans. Dismiss for the current tab session or disable site-wide in this browser.
- No background inference. Joe and photo analysis share a single request lock. The model is unloaded after a completed response. Navigation and normal API requests remain asynchronous; local inference can still use substantial laptop resources while answering. The laptop must keep the server and Ollama available; hosted/mobile synchronization is still a separate release gate.

Validation: 45 automated tests pass, including private history, foreign-project rejection, retry handling, provider boundary, shared busy lock and failure cleanup. Browser trial used a disposable project to ask for a scope draft and save a human-edited version. A lightweight API response measured 24 ms during the test session; this is not a load-test or performance guarantee.

## Cloud photo pilot and equipment (September 22)

Equipment & Fleet is available in the main navigation. Create assets, assign projects and responsible people, enter hour/mileage readings, review service due dates, and record completed maintenance. Optional vehicle fields cover plate, VIN and registration date. Locations and readings are manual. Service records preserve history and do not automatically create financial expenses.

For the authorized Windows-only cloud pilot, run SETUP_API_KEY.bat and enter the key privately. It is stored as a DPAPI-encrypted file under ignored data; never commit or share it. Restart with START_JOBSCOPES.bat. When the key exists in this installation's data directory, Project workspace > Analyze photo offers Astra and requires explicit photo/context upload consent. The local pilot allows five attempts in total, conservatively reserving $1 each; failed attempts count and the allowance survives restarts. This allowance is not a provider billing balance. Do not delete the usage database to reset it. The app does not buy credits or automatically recharge.

See ASTRA_PILOT.md for measured sample results, estimated spend, known limits and further quality gates. A completed draft is not a safety or buildability determination. Existing Ollama operation remains the default for workspaces without a configured key. OpenAI connectivity requires internet; ordinary project work does not trigger paid AI requests. The current encrypted key is tied to the Windows user and is not portable to hosted deployment.

## Photo measurement labels
Open a project > Site photos > Measurements below a photo. Choose Add measurement line, tap two endpoints, then enter starting/ending landmarks and a distance including units (for example, House corner to marker: 20 ft). Choose Measured, Approximate, or Proposed and save. Up to eight lines per photo can be edited or removed; the original image stays unchanged. Keyboard users can move the marker with arrows (Shift for larger steps) and select points with Enter.

Labels are saved with the photo and supplied as user-provided context for new photo analyses and project-context Joe conversations (the four most recent photos, with bounded context). They do not establish a general image scale or automatically calculate other distances. Existing saved analyses are reused and are not automatically rerun when labels change. Concurrent edits are rejected instead of overwriting another user's changes; reopen the editor to load the current version.
