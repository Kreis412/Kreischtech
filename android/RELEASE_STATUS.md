# Android release status — October 1, 2026

Package: `com.kreischtech.contractorsight`, versionCode 1, versionName 0.1.0.
Target SDK 36, minimum SDK 23. Google Bubblewrap generated the TWA project.

Completed: assembleDebug, bundleRelease, lintRelease; signed AAB verified using jarsigner.
Google Play accepted the 2.02 MB signed bundle into internal testing draft release 1.
Draft saved with release notes. Google review screen has one warning: no testers selected.
NOT rolled out to testers or production.

Signed artifact: app/build/outputs/bundle/release/contractorsight-0.1.0.aab
SHA256: F03CE2E90EA90D8348C431750ED664FBBF5211A7B6EE7B3CA7E875D5C9AE6D60

Upload key: upload.keystore; password in signing.properties. Both are ignored by Git.
Keep these private and make a secure independent backup before changing computers.
Google Play manages the distribution signing key. The public assetlinks fingerprint
was copied from this app's Play Console Digital Asset Links section, not the upload key.

Remaining before tester rollout:
- Deploy and verify /.well-known/assetlinks.json for fullscreen TWA verification.
- Remove website purchase prompts inside the Play app until Play Billing integration is ready.
- Obtain tester Google account emails and configure the internal track.
- Install from the private Play link and verify login, uploads/camera, measurements and analysis.

Remaining for paid public launch: Play subscription purchase/token verification and
entitlement handling, store listing/disclosures/account deletion review, phone testing.
Google payments profile also shows bank verification pending; owner must complete that.

Build (PowerShell, with Java 17 and SDK paths set):
`./gradlew.bat --no-daemon --max-workers=2 assembleDebug bundleRelease lintRelease`
Then from repository root: `node android-tools/sign-bundle.cjs`.
Increment versionCode for any new bundle after this upload.
