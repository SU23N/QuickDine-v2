# QuickDine SaaS

QuickDine gives every restaurant its own menu, QR links, kitchen feed, owner workspace and staff permissions. The central platform administrator onboards restaurants, edits plans and manages subscriptions. Yash Family ReStra & Dhaba is the first pilot workspace.

## Review version and live version

[Open the private QuickDine review site](https://quickdine-saas.surennayak1.chatgpt.site).

The private review site is built with `VITE_DEMO_WORKSPACE=true`. It runs entirely in browser storage, includes two clearly marked sample restaurants and makes no Firebase requests or real charges. Its sample Growth price is illustrative. Reset demo data from the console to start again. Demo owner switching is for review; it is not live authentication.

The normal build uses Firebase Authentication, Firestore and server-side callable functions. Without Firebase configuration it provides a labelled customer preview and disables real order submission. Live access requires the project setup and deployment below. Opening this repository, a PR or the private review site does not deploy Firebase.

## Included

- Platform console: restaurant onboarding, published/draft subscription plans, usage limits, restaurant suspension, subscription renewal invoices, received-payment recording and audit events.
- Restaurant owners: private workspaces, branding/logo and website URLs, bilingual menu/category/availability editing, configurable daily service hours, table QR sheets and kitchen ticket printing.
- Team: separate owner, kitchen and waiter accounts, private password setup links, membership revocation and server-side table/staff quotas.
- Customer: restaurant/table-specific carts, trusted menu pricing, order retry protection, advance dine-in, takeaway, waiter attribution and Hindi/English menus.
- Operations: live scoped orders, kitchen transitions, payment recording and transaction-backed daily sales/order metrics. Staff views load the latest 200 orders; metrics count all transactions.
- Billing: immutable INR subscription invoices, manual received-payment recording, free-plan activation and optional Razorpay one-time renewal checkout with captured-payment and webhook verification. Automatic recurring debit is not implemented.

## Development and checks

Use Node 22 and Java 21 for the emulator checks.

```sh
npm ci
npm ci --prefix functions
npm run dev
```

Try `/r/yash-bagbahara/customer?table=7`, `/r/yash-bagbahara/customer?mode=advance-dine-in` and `/r/yash-bagbahara/customer?mode=takeaway`. Legacy `/customer`, `/admin`, `/owner` and `/kitchen` routes retain the `VITE_RESTAURANT_ID` context. `/workspace` lists only the signed-in person's memberships; `/console` requires platform administrator access.

For a local browser-only demo, set `VITE_DEMO_WORKSPACE=true` in `.env.local`. Review mode uses hash routes such as `/#/console` so static hosting needs no rewrite. Keep this setting **false** in the real ordering deployment.

```sh
npm test
npm run build
npm run test:rules
npm run test:integration
npx playwright install --with-deps chromium
npm run test:browser
npm run test:live-browser
npm run test:demo
```

Rules tests use Firestore. Integration and live browser tests serve the actual exported callable HTTP wrappers through an emulator-only Express harness, with Authentication JWT verification and real emulator transactions. Only the payment provider API is stubbed in integration tests; no real accounts, charges or production Firebase data are used. CI runs the complete suite and uploads browser screenshots.

## Live Firebase setup

1. Select the intended project. The previously hosted QuickDine project is `quickdine-2cf4a`; verify project ownership and the target before deploying. Enable Firestore, Authentication **Anonymous** and **Email/Password**, and add the deployed domain to Authentication authorized domains.
2. Copy `.env.example` to `.env.local`. Fill Firebase web app values from Project Settings, use the real project ID, set `VITE_USE_EMULATORS=false` and `VITE_DEMO_WORKSPACE=false`. These web config values are public identifiers, not administrative credentials. Never put service-account keys or merchant secrets in Vite variables or Git.
3. Register the web app with Firebase App Check using reCAPTCHA Enterprise and set `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Production callable functions enforce App Check; unconfigured clients cannot submit orders or admin actions. Configure Firestore enforcement and domain settings in the Firebase console, and monitor failed verifications.
4. Enable the billing plan required by Cloud Functions on the intended project. This code does not enable project billing or purchase anything automatically.
5. Create the first platform administrator through the **trusted Firebase console**: create an Email/Password Authentication user, copy its UID and create `platformAdmins/{UID}` with `{ "active": true }` in Firestore. Alternatively, use trusted application-default credentials with `node scripts/bootstrap-admin.mjs PROJECT_ID ADMIN_EMAIL`. Administrator privileges cannot be granted by a public client.
6. Build and deploy the core system. The explicit function selection below keeps optional gateway secrets out of a pilot deployment:

```sh
npm run build
npx firebase deploy --project YOUR_PROJECT_ID --only firestore,hosting,functions:placeOrder,functions:updateOrder,functions:savePlan,functions:createRestaurant,functions:updateRestaurantProfile,functions:setRestaurantStatus,functions:setSubscriptionStatus,functions:createSubscriptionInvoice,functions:recordSubscriptionPayment,functions:activateFreeSubscription,functions:manageRestaurantStaff,functions:manageRestaurantTables,functions:seedPilotPlan
```

Functions run in `asia-south1`. Firebase Hosting rewrites support direct customer/QR links and page refreshes.

7. Sign in at `/login`, use password setup/reset if needed, open `/console`, initialize the Pilot plan and add Yash with its **real owner's email**. Restaurant creation starts ordering paused and creates scoped memberships/tables. Copy the private owner setup link and share it yourself with the intended owner. No email is sent automatically and no shared password is created.
8. Sign in as the owner, replace sample dishes/prices, set the correct Hindi text and service hours, add kitchen/waiter accounts, and enable accepting orders only when ready for the supervised pilot. Generate QR codes from the deployed customer URL.

The initial Pilot plan is free, 14 trial days, 20 tables, 5 staff and 1,000 orders per calendar month. The platform administrator can edit or unpublish it and publish agreed paid plans. Live paid pricing is not pre-filled with the illustrative demo Growth plan.

### Connect Yash's website

Use the live Firebase deployment origin, for example `https://quickdine-2cf4a.web.app` after deployment. Owner → Brand & team shows copyable connections:

| Website action | QuickDine route |
| --- | --- |
| Menu / Order | `/r/yash-bagbahara/customer` |
| Advance dine-in | `/r/yash-bagbahara/customer?mode=advance-dine-in` |
| Takeaway | `/r/yash-bagbahara/customer?mode=takeaway` |
| Table 7 QR | `/r/yash-bagbahara/customer?table=7` |

Use these routes on the Yash marketing site only after Firebase deployment and a successful pilot. A custom restaurant domain can be added later; it is not needed to start the pilot. Do not print localhost or private-demo QR codes for real customers.

### Optional live subscription payments

1. Set up your merchant account and create your own paid plans. Keep `VITE_ONLINE_BILLING_ENABLED=false` while using received offline payment recording.
2. Set the three server secrets using Firebase Secret Manager:

```sh
npx firebase functions:secrets:set RAZORPAY_KEY_ID --project YOUR_PROJECT_ID
npx firebase functions:secrets:set RAZORPAY_KEY_SECRET --project YOUR_PROJECT_ID
npx firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET --project YOUR_PROJECT_ID
npx firebase deploy --project YOUR_PROJECT_ID --only functions:billingCreateCheckout,functions:billingVerifyCheckout,functions:billingWebhook
```

3. Register the deployed `billingWebhook` URL in Razorpay for `payment.captured`, with the matching webhook secret. Test in provider test mode before using merchant live keys.
4. Set `VITE_ONLINE_BILLING_ENABLED=true`, rebuild and deploy hosting. Checkout creates a gateway order from the trusted invoice. Access changes only after exact amount/currency/capture and signature verification. Duplicate gateway notifications do not extend a subscription twice. Expired/conflicting paid invoices go to `billingReview` for administrator reconciliation.

These are one-time **QuickDine subscription** renewals. Restaurant food payments remain externally received and recorded by the owner; this release does not collect food payments, issue tax invoices, refund payments or perform automatic recurring debit.

## Data and access model

- Public clients can get restaurant profile/menu/table data and published plans. They cannot enumerate the restaurant list, read owner emails, subscriptions or billing records.
- Canonical permissions live at `restaurants/{rid}/staff/{uid}`, with matching private navigation records at `memberships/{uid}/restaurants/{rid}`. Disabled canonical permissions override any legacy staff record. Users cannot edit their own roles or platform-admin status.
- Existing `staff/{uid}` owner/kitchen/waiter records are accepted only when no canonical membership exists. Before migrating a legacy restaurant, create its subscription, tenant account and canonical memberships using trusted server credentials. Backfill historic daily metrics if past sales must appear in the new metrics view. New onboarding IDs cannot overwrite an existing restaurant.
- Orders, staff/table changes, licensing and billing writes go through trusted functions. Menu edits use strict owner-scoped Firestore validation. Private documents and collections deny cross-restaurant access.
- Server code validates menu prices, table/mode, contact/time and availability; totals use integer paise. Request IDs prevent retry/double-tap duplicates, including receipt recovery after subscription expiry or quota exhaustion.
- Restaurant ordering requires an active trial/paid period, unsuspended restaurant, correct service hours and remaining monthly quota. Payments do not clear an administrative suspension automatically.
- Kitchen moves `new → preparing → ready`; waiters complete ready orders; owners can record received food payments. Recorded sales use IST payment date and exclude cancelled orders. Paid food orders cannot be cancelled without a future refund process.

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the remaining live pilot gates and [VALIDATION.md](VALIDATION.md) for verified checks. Voice ordering, delivery, refunds, tax/service-charge invoices, holiday/weekday schedules and automated recurring subscription debit are outside this release.
