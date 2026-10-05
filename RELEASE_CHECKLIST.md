# Release checklist

## Implemented in this change

- URL table context (no hardcoded Table 01), per-context persistent carts and notes.
- Customer checkout with server-priced orders and duplicate-submit protection.
- Advance dine-in/takeaway with contact details and IST arrival/pickup time.
- Authenticated waiter table selection and creator attribution.
- Live Firestore menu and kitchen feeds; staff status transitions.
- Owner menu/category/availability editing and configurable daily service hours.
- Real owner payment/sales/order totals replacing demo cards.
- English/Hindi customer interface, bilingual menu fields and kitchen ticket/QR printing.
- Owner/kitchen/waiter permissions, server-only order writes and emulator tests.

## Required before a restaurant pilot

- [ ] Configure the intended Firebase web app, enable Anonymous and Email/Password authentication, and add the hosting domain.
- [ ] Provision owner/kitchen/waiter users and `staff/{uid}` records using the console/Admin SDK.
- [ ] Review billing/project target; deploy rules, indexes, callable functions and hosting.
- [ ] Initialize the restaurant with ordering paused; replace sample prices/dishes and verify Hindi descriptions.
- [ ] Set actual daily service hours. Holiday/weekday exceptions require a later scheduling feature.
- [ ] Complete one table order, one waiter order, one advance dine-in and one takeaway from separate customer/staff devices.
- [ ] Test QR scans for tables 1/7/20; wrong/inactive tables must reject checkout. Deactivate tables through the Firebase console for now.
- [ ] Change a dish price/availability while another customer has it in their cart; checkout must use current trusted prices and reject sold-out items.
- [ ] Drop the network while sending, retry, and confirm a single order and matching receipt. Do not edit/reorder until an uncertain submission is reconciled against recent orders.
- [ ] Confirm kitchen accept/prepare/ready updates reach the customer; confirm waiter completion and owner payment recording persist after refresh.
- [ ] Check Hindi and English layouts at 375 px and on the actual restaurant phones.
- [ ] Print QR sheets and kitchen tickets on the actual printer; inspect Hindi fonts, long instructions and page sizing.
- [ ] Test direct QR route refresh on deployed hosting.
- [ ] Configure backup/retention and an operational fallback for network outages.

## Required before an unattended public launch

- [ ] Add Firebase App Check enforcement and monitor anonymous-account/order abuse. Per-UID limits alone can be bypassed by creating new accounts.
- [ ] Add refund/payment reconciliation if paid-order cancellation is needed; never directly change paid orders to cancelled.
- [ ] Verify privacy notice, customer-data retention and who can access contact details.
- [ ] Add bounded/date-range staff queries and retention as order volume grows; current staff views subscribe to all restaurant orders.
- [ ] Run a supervised restaurant pilot and review failed/retried/duplicate orders.

## Optional later work

Voice-to-text/voice conversation; delivery; online payments; tax/service-charge invoices; holiday/weekday service hours; advanced analytics; table-session QR tokens; stock-level tracking; multi-restaurant switching; Play Store packaging.
