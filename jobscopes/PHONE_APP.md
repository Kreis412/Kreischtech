# Phone app milestone — September 30, 2026

ContractorSight is installable from the existing HTTPS pilot URL. Accounts, projects and storage stay on the same Render service. No second server or changed credentials.

Android: visit in Chrome, use Install phone app or browser menu > Install app / Add to Home screen. iPhone: Safari > Share > Add to Home Screen. Installation behavior varies by browser. This is an installable web app, not yet a Google Play or Apple App Store release.

Mobile improvements: compact expandable navigation, 44px minimum controls, 16px form text, safe-area spacing, installation help and persistent offline status. First-job onboarding appears for empty workspaces.

Offline: only a public reconnect page is cached. No authenticated API response or customer photo is cached by the service worker. Existing IndexedDB photo queue remains scoped to account/company/project. Keep an already loaded project open to queue images when connectivity drops. Reopen it online and Retry; offline launch does not expose project records. Clearing browser data may remove pending originals; retain originals. No background sync, full offline project editing or offline AI is promised.

## Store release work remaining

Use Google's Bubblewrap / Trusted Web Activity tooling against /manifest.webmanifest to build the Android package. Complete developer-account verification, choose the permanent package identifier, securely retain signing keys, publish the actual signing certificate's Digital Asset Links on this same origin, then test a signed package on physical devices. Do not invent certificate fingerprints. Play Console testing/review, data safety, privacy/account-deletion disclosures, screenshots and subscription/payment compliance remain release requirements. No Android signing key, paid developer account or store listing was created in this milestone. Apple distribution is a separate later release.

References: https://developer.chrome.com/docs/android/trusted-web-activity/quick-start and https://web.dev/learn/pwa/installation

## Commercial direction agreed

Focus on small contractors. Subscription for regular use; pay-as-you-go with higher per-analysis pricing for occasional use. Saved results should be free to reopen. Display price and AI allowance before purchase/use; no surprise auto-renewal, automatic charges or invented savings claims. Price, included usage, trial allowance and payment provider remain undecided. This release does not charge users or claim a purchasable subscription exists.

Validate cost per successful analysis, failed requests/retries, hosting/storage, payment fees and support before pricing. Keep customer review in the workflow. Sell practical value: photos -> reviewed discoveries -> estimate items -> job costs.

## Logo

Approved CS foreground / subtle K background logo, black and teal. Generated using the built-in image-generation tool. Master: public/contractorsight-cs-k-logo.png; app exports: public/app-icon-192.png and public/app-icon-512.png. Earlier concept preserved as public/contractorsight-logo.png.

Final edit prompt: Replace the central symbol with clearly readable bold geometric uppercase letters CS in bright teal, with one larger understated dark-teal uppercase K behind the CS as a background monogram for KreischTech. CS must be the unmistakable foreground and remain legible at small phone-icon size; K subordinate but recognizable. Preserve the black background and cool industrial teal identity. Use crisp solid flat lettering with minimal glow, no target crosshairs. One square full-bleed black app icon, center all lettering inside the middle 65% safe area, no extra words or mockup.
