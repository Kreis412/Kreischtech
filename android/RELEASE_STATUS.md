# Android release status — October 2, 2026

Package: `com.kreischtech.contractorsight`, versionCode 1, versionName 0.1.0.
Target SDK 36, minimum SDK 23. Google Bubblewrap generated the TWA project.

Completed: assembleDebug, bundleRelease, lintRelease; signed AAB verified using jarsigner.
Google Play accepted the 2.02 MB signed bundle into internal testing draft release 1.
Internal testing release 1 published October 2, 2026. Play Console confirms Active and
Available to internal testers. Confirmed two-person tester list selected and saved.
Join link: https://play.google.com/apps/internaltest/4701651026528931322
Not released to production. Google may display the temporary package-name title until reviewed.

Signed artifact: app/build/outputs/bundle/release/contractorsight-0.1.0.aab
SHA256: F03CE2E90EA90D8348C431750ED664FBBF5211A7B6EE7B3CA7E875D5C9AE6D60

Upload key: upload.keystore; password in signing.properties. Both are ignored by Git.
Keep these private and make a secure independent backup before changing computers.
Google Play manages the distribution signing key. The public assetlinks fingerprint
was copied from this app's Play Console Digital Asset Links section, not the upload key.

Deployment verified: /.well-known/assetlinks.json serves the Play signing fingerprint;
the deployed billing module includes the Android test purchase-control gate. Commit 3a4af2b.
Fullscreen behavior and the gate still require verification on a Play-installed phone.

Remaining test verification:
- Install from the private Play link and verify login, uploads/camera, measurements and analysis.

Remaining for paid public launch: Play subscription purchase/token verification and
entitlement handling, store listing/disclosures/account deletion review, phone testing.
Google payments profile also shows bank verification pending; owner must complete that.

Build (PowerShell, with Java 17 and SDK paths set):
`./gradlew.bat --no-daemon --max-workers=2 assembleDebug bundleRelease lintRelease`
Then from repository root: `node android-tools/sign-bundle.cjs`.
Increment versionCode for any new bundle after this upload.

## October 16, 2026 — product setup prerequisite

Built versionCode 2 / versionName 0.1.1 with com.android.vending.BILLING permission.
This build unlocks Play product-catalog setup only. It does not enable purchases:
the existing Android billing screen remains gated pending integration and verification.

Validation: bundleRelease and lintRelease passed; jarsigner verified the signed bundle;
merged release manifest confirms version 2 and BILLING permission.
Artifact: app/build/outputs/bundle/release/contractorsight-0.1.1.aab
SHA256: 4AB9F669C879EDDB5E1046C2A849904C89695B84777D7DC4BBDC0D12769959CE

Minimum SDK raised to 24 (Android 7): Play automatic protection rejected the SDK 23 upload. Rebuilt and verified with SDK 24.

Version 0.1.1 was accepted into the artifact library but release validation required Billing Library 8. Superseded by versionCode 3 / 0.1.2, which includes billing:8.0.0. bundleRelease, lintRelease and signature verification passed. Purchases remain gated. SHA256: 6A79ED49842EF05425EA8F72EB150F47432D5160570AFB622CB7BC650788FB37
