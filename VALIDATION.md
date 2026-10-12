# Validation — 12 October 2026

Base: `SU23N/QuickDine-v2`, release commit `ea6527ba7cdbe1ef9ae3fdd79180fc6d093c9bb6`. SaaS completion is prepared on `codex/quickdine-saas-completion-20261012`.

| Check | Status |
| --- | --- |
| Production Vite build | Passed locally |
| Order/SaaS domain tests | 15 passed locally |
| Firestore permission tests | 7 passed locally |
| Actual callable HTTP + Auth/Firestore emulator integration | 15 passed locally |
| Customer preview browser checks | CI verification pending |
| Live ordering browser checks against emulators | CI verification pending |
| SaaS review browser workflows + mobile/screenshots | CI verification pending |

The integration harness mounts the actual exported callable functions, verifies Authentication JWTs and uses real Firestore emulator transactions. Razorpay network responses are stubbed; signatures, trusted invoice comparisons, settlement and webhook idempotency exercise the implementation. Tests never target production Firebase or charge real money.

The SaaS browser workflows cover onboarding, menu isolation, branding, table order → scoped kitchen → recorded sales, subscription invoices, QR links, native-dialog focus/Escape and mobile overflow. Browser verification runs in GitHub Actions with Node 22/Java 21/Chromium; no local preview/browser is available in the managed environment.

The private review site runs only the explicitly labelled browser-storage demo. Passing tests and deploying that review site do not prove live Firebase configuration, merchant account activation, real-device/printer compatibility or restaurant pilot completion. No production project deployment, real staff password, real customer order or actual payment was used for local checks.
