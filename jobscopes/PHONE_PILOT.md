# ContractorSight phone pilot — September 22, 2026

## Current state
Restricted hosted pilot code is ready for deployment testing. It is not a public customer release. 57 automated checks pass. No live paid AI requests were made while preparing this change.

## Render configuration
- Repository: Kreis412/Kreischtech
- Branch: jobscopes/company-foundation
- Root directory: jobscopes
- Build: npm ci && node --test
- Start: node server.mjs
- Runtime environment: NODE_VERSION=22
- Single paid 0.5 CPU / 512 MB server, 5 GB disk mounted at /var/data
- DATA_DIR=/var/data
- Auto-deploy: Off
- Default TCP health check for first deployment
- RENDER_EXTERNAL_URL supplies the assigned HTTPS origin. PUBLIC_ORIGIN can override it for a verified custom domain.
- Backend port must be reachable only through the trusted TLS proxy. Validate Host and X-Forwarded-Proto behavior on Render before real records.

## Private values to enter directly on Render
- OPENAI_API_KEY: user's API key; never commit, print or paste into chat.
- PILOT_REGISTRATION_CODE: a long private enrollment code chosen by the user. Empty disables registration. This is not email verification or password recovery.
- AI_PILOT_MAX_ATTEMPTS=2 for a new empty pilot ledger only. The laptop ledger already has eight requests against the previously authorized ten-attempt allowance. These two remaining requests are shared by Joe and photo analysis. Do not also spend the laptop's remaining allowance. Do not reset the cloud ledger to refresh allowance. If migrating the original ledger, use a total ceiling of ten, not two.

## Implemented
- Secure cookies, exact HTTPS origin and Host validation, cross-origin write rejection; local mode remains localhost only.
- Private-code enrollment; account/company isolation and role checks.
- Portable photo processing with 1600px bounds, rotation and metadata stripping.
- Hosted Joe through OpenAI; local mode retains Ollama. Questions plus up to three recent exchanges are sent when submitted. Project context requires checkbox opt-in. No photos or financial records automatically added to chat. Human review remains required for proposed notes.
- Joe and photo analysis share persisted reservations. Failed/uncertain requests consume an attempt; no automatic retry. Hosted Joe duplicate request keys cannot create a second charge after restart. Output/context bounds limit workload. Reservations are conservative controls, not a guarantee of exact API cost.
- Full encrypted offline installation archive, including accounts, company data/photos and usage ledger. A real-schema test restores accounts and a project, restarts the service, signs in and retrieves the restored project.

## Recovery procedure
Stop the server before taking a full archive. Privately set BACKUP_PASSPHRASE, then run:

    node backup-installation.mjs backup /var/data /path/outside-data/backup.enc --service-stopped

Restore only into a new directory while stopped:

    node backup-installation.mjs restore archive.enc new-directory --service-stopped

Keep archive copies off-device and the passphrase separately. Windows DPAPI keys do not migrate to Linux. This archive buffers data in memory and is limited to small pilot datasets; scheduled off-device backups and large-scale recovery remain work. Do not rely on provider filesystem snapshots alone for SQLite recovery.

## Live validation still required
1. Complete the Render form and confirm billing/provider readiness.
2. Verify deployed TLS/origin behavior and rejection of anonymous private-record requests.
3. Create a fictional pilot account/project; use separate phone and desktop sessions.
4. Upload a test photo, record a discovery, and verify it on the other device after refresh. Check edit conflicts and persistence after a redeploy.
5. Use at most one Joe and one photo request from the remaining allowance after the private key is installed; review answers manually. Software tests do not establish AI accuracy.
6. Verify backup export and restore using hosted fictional records before migrating real data.

Offline queue/recovery, automated off-device backups, verified identity/recovery, restricted field/customer roles, independent security review, scale/load tests and public billing are not finished. A single disk-backed instance has deployment downtime and cannot scale horizontally. This is the inexpensive pilot setup, not the final large-company architecture.

## Cost reference
Candidate base: $7/month server + 5 GB at $0.25/GB/month = $8.25/month. AI, backup destination, taxes, bandwidth overage and optional plan upgrades are separate. No service was created by this code change.
https://render.com/pricing
https://render.com/docs/disks
https://render.com/docs/environment-variables
