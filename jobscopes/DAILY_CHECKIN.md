# Photo-first Home and daily check-in

Deployed features: business-name/profession-aware home, prominent project photo chooser, next project steps, links to business tools, optional once-per-local-day check-in, local-device personal tasks, owner/manager YTD recorded cash snapshot, and consent-based local weather.

Weather uses MET Norway Locationforecast through an authenticated server proxy. Coordinates are rounded to 2 decimals, forecast cache is bounded, requests identify the app, and attribution/license links are displayed. No background location collection. Weather unavailable/permission denied does not block the app.

## Morning push

Off by default. Settings > Daily check-in explains notifications before Enable triggers the browser prompt. Default 07:00 with an editable IANA time zone detected from the device and editable time. Users who travel must update the zone. One reminder per device/day, sent within an hour of the requested time if the server is running. Device/network/OS may delay delivery; TTL is one hour. The notification contains generic text only and opens /#checkin. There is a test button, one-minute test cooldown, device opt-out, and sign-out unsubscribe. Removed memberships are pruned by the scheduler. Maximum five devices per user.

VAPID keys and subscriptions persist in push-reminders.sqlite under DATA_DIR. Never publish this database or rotate its keys without considering existing subscribers. No extra environment key is needed. Standard browser push delivery uses the web-push package. Existing TWA users must close/reopen to update the service worker; notification provider/display behavior on physical Android still requires a Send test notification check. No new Android binary or native widget was created in this change.

143 automated tests pass, including scheduler ownership, DST/local time, duplicate prevention across restart, opt-out, provider allowlist, and permission denial. No real customer notification or payment was sent during automated testing. Weather provider smoke check used public London coordinates. Google Play Data safety declarations should be reviewed for optional approximate-location and push-subscription collection before the next store submission.
