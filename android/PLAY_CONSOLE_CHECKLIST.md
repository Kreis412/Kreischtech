# Google Play launch checklist

## Already completed

- Internal testing release 1 (version 0.1.0) is active.
- Tester list contains `rkreischer412@gmail.com` and `sarahansell1984@gmail.com`.
- Privacy policy saved: `https://contractorsight-pilot.onrender.com/privacy.html`.
- Public account-deletion request page: `https://contractorsight-pilot.onrender.com/delete-account.html`.
- Ads declaration: no ads.
- Government-app declaration: no.
- Health declaration: no health features.
- Financial declaration: Other — construction project estimates, material and labor cost tracking, budgets, revenue and project-profit reports. It does not provide banking, lending, investments, insurance, money transfers, or regulated financial advice.

## Still required in Play Console

1. Complete **Sign in details**. Google requires a reviewer account that can reach the app. Use a dedicated review workspace with sample data, not a personal or customer account. The reviewer account must not require the private pilot code or an invitation.
2. Complete **Target audience and content** after Sign in details.
3. Complete **Data safety** using the hosted privacy notice as the source of truth. The service collects account information, project records, photos/documents, measurements, equipment records, messages, AI results, usage records and payment/subscription identifiers. Data is shared with Render for hosting, Stripe for card payments and OpenAI only when a user requests cloud AI.
4. Complete **App category and contact details** and **Store listing**.
5. Review **Publishing overview**, then send the completed changes for Google review.

## Paid Android release

The current Android build intentionally hides website checkout. Before charging through Google Play, add a Google Play subscription product and integrate TWA Digital Goods/Payment Request billing with server-side purchase-token verification and acknowledgement. Do not expose Stripe checkout inside the Play-distributed app. The existing Stripe flow remains for web customers.

## Current test link

`https://play.google.com/apps/internaltest/4701651026528931322`
