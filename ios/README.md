# ContractorSight iPhone prototype

Started November 7, 2026. Native SwiftUI prototype; not an App Store submission and not yet compiled on macOS. No changes to the live Android deployment.

## Implemented source

- iPhone/iPad layout, dark appearance, teal controls, accessible text labels.
- Take a photo with the system camera or select an image through PhotosPicker.
- Normalize orientation, limit saved dimensions to 2048 pixels and omit original EXIF metadata.
- Save photos and notes locally without network access, using atomic files with iOS file protection.
- Preserve unsaved entries when a disk write fails; refuse to overwrite an unreadable draft index.
- Reopen drafts and explicitly share a note or saved photo using the system share sheet.
- XCTest cases for persistence, empty entries, and preserving corrupt storage.

Drafts are local, not uploaded or associated with a company. Deleting the app can lose these drafts. Cloud-only iCloud images may need internet to download before they can be saved. This prototype has no analytics SDK, account login, AI calls, payments, notifications, or voice recognition. No API keys are embedded.

## First Mac build

Use a Mac with current stable Xcode and its iOS Simulator installed. Install XcodeGen from its official project, then in this folder:

```sh
xcodegen generate
open ContractorSight.xcodeproj
```

Choose ContractorSight, select an available iPhone Simulator, and Run. Use Product > Test to run the three persistence tests. No paid developer membership is needed for the Simulator. For a physical device, select your Apple development team in Signing & Capabilities. Camera behavior needs physical-device testing.

Generated project/plist files are intentionally ignored; project.yml is the source of truth. There is no Apple team ID or signing credential committed here.

## Before connecting real customer accounts

1. Implement a native authentication contract with the existing backend. The current web backend requires an exact Origin header on writes and uses cookie sessions. Do not disable the origin guard or permit all origins. Define authenticated native sessions, secure Keychain storage, sign-out, expiration, and server-side company authorization together.
2. Fetch the signed-in user's projects. Have the user explicitly attach a local draft to a project. Bind pending uploads to the original account and business; never upload anonymous drafts automatically after a different user signs in.
3. Upload photos with persistent idempotency IDs. Acknowledge success before deleting any local copy. Retry transport safely; never automatically repeat a billed AI analysis after an ambiguous timeout.
4. Reuse server analysis/estimate/material-list endpoints and credit accounting. AI needs a connection; offline capture does not imply offline AI.
5. Integrate StoreKit subscriptions/consumables and server transaction verification, restores, revocations and renewals. Keep Apple, Google Play and Stripe entitlements consistent. Product identifiers and prices must be approved before products are created. Do not route iOS customers into the existing web checkout as an assumed substitute.
6. Complete in-app account deletion, privacy disclosures, AI-result reporting, permissions, production icons, and App Review demo access. Review current Apple requirements before submission.

## Device acceptance tests

- Camera allowed, denied, canceled; selection canceled; iCloud image unavailable offline.
- Save photo/note in airplane mode, force quit and reopen; verify content and orientation.
- Disk write failure preserves draft text/photo and does not report success.
- VoiceOver, larger text, small iPhone and iPad layouts.
- Repeated photo selections, large HEIC photos and memory pressure. Current loading decodes UIImage in memory; measure peak memory before release and switch to ImageIO downsampling if needed.
- Complete authenticated sync, credits, purchases and account deletion tests once integrated.

## Costs and next gate

No paid service was provisioned. Mac build/device verification is the next technical gate. Apple Developer Program enrollment is separate and is needed for TestFlight/App Store distribution. Do not advertise this prototype as available for download.

References: https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/programs/ ; https://github.com/yonaskolb/XcodeGen
