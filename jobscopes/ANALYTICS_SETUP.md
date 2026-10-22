# Optional Firebase Analytics

Firebase project: contractor-sight (Spark). Web app: ContractorSight Web and Play.
GA account 311561375, property 560170954, stream 16180528441, measurement G-09GL5SNV9E.
Dashboard: https://analytics.google.com/analytics/web/#/a311561375p560170954/realtime/overview

Android TWA uses the same web analytics. This does not install native Android Analytics or establish Google Ads install attribution.

Collection starts only after explicit consent. Settings > Privacy & analytics controls this browser/device preference. No SDK is requested before consent. Advertising storage, ad user data, ad personalization and Google signals are disabled. Keep Enhanced measurement disabled: automatic form/link/history tracking could expose project identifiers. page_location is always the public origin; page_referrer is blank. Parameters only permit sanitized screen names. Never add project IDs, names, filenames, email, amounts, questions or image data.

Events: app_open, screen_view, photo_capture_started, photo_upload_completed, photo_analysis_completed, project_created, login, sign_up, estimate_saved, joe_answer_received, measurement_saved, daily_checkin_opened, feature_request_failed. Capture-start means a photo action was selected, not successful capture. Reused analyses are excluded. No purchase revenue event is inferred from button clicks.

Only consenting visitors are represented. Ad blockers and unsupported browsers may prevent collection. Analytics failures must never block app actions. Public Firebase configuration is not a service-account secret.

Review Play Data safety for optional Analytics collection of app interactions, device/other identifiers and approximate location. Explain purpose Analytics and optional collection; review current Google SDK disclosure guidance and the complete existing declaration before submitting. This integration has no native Advertising ID permission.
