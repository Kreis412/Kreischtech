# Company snapshot recovery

Only the selected company's Owner can export a snapshot from Security. It includes that company's job records and photo bytes, but NOT the accounts database, passwords, memberships, invitations or sessions. Save the download together with the company name and date in your backup records. Choose a unique passphrase of at least 16 characters; JobScopes cannot recover a lost passphrase.

To validate and unpack an encrypted snapshot without overwriting anything:

```powershell
node restore-backup.mjs "C:\path\backup.jobscopes" "C:\path\new-recovery-folder"
```

Enter the passphrase at the hidden prompt. The parent directory must exist and the recovery directory must not exist. The tool rejects altered files and wrong passphrases, then checks SQLite integrity and expected tables. Keep the original snapshot and workspace until recovery is reviewed. Restoring into a running company's folder is deliberately not supported. Do not point the product's DATA_DIR at this single-company snapshot: the product also requires its separate accounts database and membership mapping.

For complete local disaster recovery, stop JobScopes and protect a copy of the entire data folder, including accounts.sqlite and companies/. These files are not encrypted by the application; protect the backup location separately. Full automated encrypted account-and-workspace recovery is a hosted-release gate. The database export temporarily creates a plaintext snapshot inside the private company data folder and removes it after use; a crash may leave a .backup-* temporary folder. Export is processed in memory and is not yet designed for very large photo collections.

Current network restrictions must remain enabled. The preview has sign-in and company isolation but lacks HTTPS, verified email, account recovery and external security review. No customer or field-crew role exists yet. It is not a production hosting package.
