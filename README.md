# QuickDine V2

Restaurant ordering for Yash Family ReStra & Dhaba. Includes table QR context, customer cart and checkout, advance dine-in/takeaway, waiter attribution, owner menu editing, live kitchen orders, recorded payments, Hindi/English UI and printable kitchen tickets/table QR sheets.

Without Firebase configuration the app shows a clearly labelled menu preview and disables order submission. There is no simulated order success or fake sales data.

## Local preview

Use Node 22 (the Cloud Functions deployment runtime) and Java 21 for emulator tests.

```sh
npm ci
npm run dev
```

Try `/customer?table=7`, `/customer?mode=advance-dine-in` and `/customer?mode=takeaway`. Customer carts persist separately by restaurant, initial table and initial mode. Owner/admin/kitchen routes require a configured, authorized staff account.

## Firebase setup

1. In the intended Firebase project, enable Firestore plus Authentication providers **Anonymous** and **Email/Password**. Add the deployed domain to Authentication's authorized domains.
2. Copy `.env.example` to `.env.local` and fill the Firebase **web app** configuration from Project Settings. Set `VITE_RESTAURANT_ID` to a stable restaurant ID (default `yash-bagbahara`). These browser config values are not administrative credentials. Never put service account keys/passwords in Vite variables or Git.
3. Install the functions dependencies: `npm ci --prefix functions`.
4. In Firebase Authentication, create separate email/password users for the owner, kitchen and waiter. Use the Firebase console or a trusted Admin SDK to create **`staff/{AUTH_UID}`** documents:

```json
{ "restaurantId": "yash-bagbahara", "role": "owner", "active": true }
```

Valid roles: `owner`, `kitchen`, `waiter`. Client apps cannot create or modify staff roles. Set `active:false` to revoke access. Do not share the owner account with waiters.

5. Build and deploy the rules, indexes, functions and hosting to the selected project **after reviewing billing and the deployment target**:

```sh
npm run build
npx firebase deploy --project YOUR_PROJECT_ID --only firestore,functions,hosting
```

Cloud Functions deployment requires a billing-enabled Firebase project. No deployment is performed by opening this repository or PR. Hosting rewrites support direct QR links and page refreshes. Callable functions run in `asia-south1`.

6. Sign in as the owner at `/login`, open `/admin` and initialize the restaurant/sample menu. This creates 20 active tables and leaves ordering **paused**. Verify dish prices, translations and the sample service hours (10:00–22:00 IST). Set your actual daily opening/closing times, then accept orders. Service hours can cross midnight; equal opening/closing times are invalid. Advance orders must be 15 minutes to 7 days ahead and inside these hours. All restaurant times are India time.
7. Generate table QR codes **from the deployed website**, print them and test tables 1, 7 and 20. Codes generated on localhost point to localhost and must not be used in the restaurant.

## Order and security model

- Public clients can read restaurant/menu/table data. Customers can read only their own orders. Restaurant staff can read that restaurant's orders.
- Order writes and status/payment changes go through callable functions. Direct Firestore order writes are denied even to owner clients.
- The server validates quantities, contact/time/table context and availability, obtains menu prices and snapshots dish names/prices. Totals are in integer paise. A changed total requires reconfirmation.
- A persisted request ID and submission snapshot produce one order for retries/concurrent double taps. An uncertain response locks edits until retry recovers the receipt or a definitive validation rejection unlocks the cart. Existing receipts remain retrievable after menu availability changes. Reusing an ID for a different payload is rejected.
- The kitchen moves `new → preparing → ready`; waiters mark ready orders completed. Owners can perform these transitions, cancel unpaid active orders and record a payment received outside the app.
- Sales mean **payments recorded today (IST)**, excluding cancelled orders. This app does not collect online payments or calculate GST/service charges. Displayed totals are menu-item totals.
- Paid orders cannot be cancelled until a future refund workflow is implemented. New unpaid orders can be cancelled by the owner.
- Basic per-UID order limits are enforced (5/minute, 50/day). These are not sufficient abuse protection for an anonymous public launch; Firebase App Check/rate monitoring remain a production gate.

## Checks

```sh
npm test
npm run build
npm run test:rules
npm run test:integration
npx playwright install --with-deps chromium
npm run test:browser
npm run test:live-browser
```

Rules tests run against the Firestore emulator. Integration tests serve the **actual callable HTTP wrappers** using an emulator-only Express harness, with Authentication JWT verification and real Firestore transactions against Auth/Firestore emulators. This avoids relying on worker Unix sockets and never targets production. Browser checks cover preview/table context, cart persistence, Hindi switching, checkout fields, route gating and mobile layout. A full live-browser test also places a customer order, checks kitchen status updates/printing, waiter completion, owner live price edits/QR generation and recorded sales. CI runs all these checks.

For manual full-app emulator testing, copy `.env.example` to `.env.local`, use the demo project ID `demo-quickdine`, any nonempty web config values, and `VITE_USE_EMULATORS=true`. Start `npx firebase emulators:start --project demo-quickdine` and the Vite server. Create emulator users/staff roles in the emulator UI. Do not use demo IDs as production configuration.

## Remaining release gates

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Real project configuration, staff provisioning, deployment and a restaurant pilot are still required. Voice ordering, delivery, refunds, holiday/custom per-day schedules, online payments and multi-restaurant navigation are outside this implementation.
