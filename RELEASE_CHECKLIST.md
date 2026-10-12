# QuickDine SaaS release checklist

## Implemented

- [x] Central platform administrator, restaurant onboarding and private owner membership navigation.
- [x] Separate restaurant branding, menus, tables, orders, staff and invoices.
- [x] Server-priced QR/table, waiter, takeaway and advance dine-in orders with retry receipts.
- [x] Live kitchen/order status, bilingual menus, printable tickets and table QR sheets.
- [x] Transaction-backed daily recorded sales and order metrics; latest-200 staff feed.
- [x] Published plans, trials, subscription expiry/suspension, server table/staff/monthly-order quotas.
- [x] Invoice price snapshots, received offline subscription payments, free-plan activation.
- [x] Optional one-time Razorpay renewal checkout, capture validation and idempotent signed webhooks.
- [x] Explicit browser-local demo for private review; production clients cannot self-promote roles.

## Before the Yash pilot

- [ ] Connect/authorize the intended Firebase project and review the billing-enabled deployment target.
- [ ] Configure web app values, Anonymous + Email/Password auth, authorized domains and App Check.
- [ ] Create the first platform administrator through trusted console/Admin SDK.
- [ ] Deploy Firestore rules/indexes, core callable functions and Firebase Hosting.
- [ ] Onboard Yash while ordering is paused; replace sample dishes, prices, translations and logo.
- [ ] Set real daily service hours; verify advance-time rules in IST. Holiday/weekday exceptions need later scheduling work.
- [ ] Create separate owner, kitchen and waiter access; test disabling a member, cross-restaurant denial and private billing visibility.
- [ ] Set agreed live plans. If online renewal is used, configure merchant secrets/webhook, verify provider test mode, then activate live keys.
- [ ] Place one table order, waiter order, advance dine-in and takeaway from separate actual devices.
- [ ] Change dish price/availability while a customer has an old cart; verify current prices and sold-out rejection.
- [ ] Interrupt the network during submission, retry, and confirm one persisted order/receipt.
- [ ] Complete kitchen → ready → served flow and confirm owner payment recording/IST sales after refresh.
- [ ] Test table 1/7/20 QR, invalid/inactive tables, subscription expiry and order quota messages.
- [ ] Print QR sheets/tickets using the actual printer; inspect Hindi, long instructions and page sizing.
- [ ] Test deployed direct route refresh, Hindi/English at 375 px, actual phones and Safari as relevant.
- [ ] Connect Yash marketing website to the verified live customer routes.

## Before unattended public use

- [ ] Monitor App Check/authentication failures, anonymous abuse, quota alerts and function errors.
- [ ] Configure database backup/retention and a restaurant fallback for network outages.
- [ ] Review privacy/customer-data retention and who receives contact details.
- [ ] Reconcile provider payments, billingReview items and offline subscription references.
- [ ] Run a supervised restaurant pilot and review failed/retried orders.
- [ ] Backfill/migrate historic staff/subscriptions/metrics if adopting existing restaurant data.

## Later features

Automatic recurring subscription debit, restaurant online food payments, refunds, GST/service-charge invoices, voice ordering, delivery, holiday schedules, stock-level tracking, advanced reporting and mobile app packaging.
