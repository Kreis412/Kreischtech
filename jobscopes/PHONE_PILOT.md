# Phone pilot deployment preparation — September 22, 2026

Status: access-policy foundation tested locally; NOT deployed or production approved.

## Candidate configuration (review before creating a paid service)
- Provider: Render paid Node web service, Starter; one instance.
- Repository subdirectory: jobscopes. Keep the marketing website separate.
- Node: 22.14 or newer compatible Node 22 release.
- Build: node --test. Start: node server.mjs.
- Persistent disk: 5 GB mounted at /var/data; DATA_DIR=/var/data.
- PUBLIC_ORIGIN: exact assigned https:// hostname, no trailing slash.
- Provider PORT is used. Setting PUBLIC_ORIGIN changes the bind address to 0.0.0.0.
- The backend port MUST be inaccessible except through the provider TLS proxy. That proxy must overwrite X-Forwarded-Proto and preserve the configured Host. A forwarding header alone is not proof of encryption. Verify on the actual provider before using real records.
- Without PUBLIC_ORIGIN the original localhost-only guards remain enabled.
- Do not configure automatic deployment of future commits until release checks are established.

## Cost proposal
Render published pricing checked September 22: Starter $7/month plus disk $0.25/GB/month = $8.25/month for 5 GB. Not an all-inclusive cap: AI, backup destination, taxes, outbound usage and plan extras are separate. No service has been purchased. No monthly spend approval inferred from the user's earlier $50–$100 startup budget.
Sources: https://render.com/pricing and https://render.com/docs/disks

## Completed preparation
- Explicit configured HTTPS origin with Host and origin validation.
- Secure session cookie issuance and clearing in hosted mode.
- Same access guard applied to company workspace routes.
- Integration test through a simulated TLS proxy for registration, project save/read and logout; wrong-host, insecure-forwarding and cross-origin rejection tests.
- Default local operation retained; real data untouched.

## Required before phone pilot with real records
1. Decide hosting account and authorize actual recurring cost; connect the correct GitHub repository/branch.
2. Restrict pilot enrollment; public registration is not yet appropriate. Finish identity/recovery policy.
3. Validate real TLS/proxy behavior, authentication, permissions and isolation externally.
4. Implement full consistent account + company database backups, encrypted off-device storage and test restore. Do not rely solely on filesystem snapshots for live SQLite recovery.
5. Migrate a reviewed copy of data only after backup; retain local originals. Never commit databases or API secrets.
6. Port cloud photo preparation/key loading: current DPAPI and PowerShell helpers are Windows-specific. The laptop's Ollama is also unavailable on Render. Do not advertise hosted Joe/photo AI until these are connected and tested.
7. Verify phone camera upload -> desktop refresh -> photo/discovery visible, then desktop edit -> phone refresh. This is shared server storage, not automatic live updates or offline sync yet.
8. Interrupted uploads, duplicate prevention, unsaved edit protection, disk usage limits and monitoring remain work.

The single-instance SQLite pilot is a starting point; attached disks do not support horizontal scaling or zero-downtime deployment. Larger-company scale still requires load testing and a storage migration plan.

## Implementation update
Hosted photo preparation now uses sharp (rotation, 1600px bounds, metadata removal). Set OPENAI_API_KEY only in Render secrets. AI_PILOT_MAX_ATTEMPTS defaults to 0; enable only the remaining authorized allowance, accounting for the existing laptop ledger. No paid inference was run for this update. Joe text chat still requires laptop Ollama and is not hosted.

Hosted registration requires PILOT_REGISTRATION_CODE. Empty/unset disables registration. Choose a long private code in Render secrets; share only with pilot testers. This is enrollment control, not email verification.

Build command is now `npm ci && node --test`; sharp is pinned. Local startup requires `npm ci` once as well.

Full encrypted offline archive: stop the service, privately set BACKUP_PASSPHRASE, then `node backup-installation.mjs backup /var/data /path/outside-data/backup.enc --service-stopped`. To restore: `node backup-installation.mjs restore archive.enc new-directory --service-stopped`. Never overwrite live data. Includes accounts, company databases/photos and AI quota ledger. Keep archives off-device and passphrases separately. Windows DPAPI credentials are not portable to Linux.

Archive round-trip has mock-file tests only. Real-schema recovery and off-device automation remain outstanding. This implementation buffers files in memory and is suitable only for small pilot datasets. First deployment must use fictional test records until recovery, actual TLS/proxy and phone/computer checks pass. Do not migrate real records yet.

Recovery test update: encrypted full archive was also restored into a new installation using actual account and project schemas. Login and project retrieval passed after restarting from the restored copy. Off-device automation and large-data recovery are still outstanding.
