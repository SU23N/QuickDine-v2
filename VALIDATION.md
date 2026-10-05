# Validation — 2 October 2026

Base repository: SU23N/QuickDine-v2, main commit e3c3849a67a127a49fd39e046e96fb3fd39f07a1.

| Check | Result |
|---|---|
| Production Vite build | Passed |
| Order domain tests | 7 passed |
| Firestore permission/rules tests | 4 passed |
| Callable HTTP + Auth/Firestore emulator integration tests | 7 passed |
| Customer preview/mobile browser tests | 4 passed |
| Full browser workflow against emulators | 1 passed |

**23 tests passed.** The live browser test covers a table order with a deliberately lost HTTP response and receipt recovery without duplication, kitchen preparation/ready transitions and print output, waiter completion and order creation, owner menu price updates and QR generation, Hindi output, recorded payment/sales, advance dine-in and takeaway checkout. Hindi mobile layout and kitchen ticket screenshots were visually inspected. Devanagari fonts are bundled with the app.

Cloud Functions worker Unix sockets were unavailable in this execution environment. Integration/browser tests use the actual exported callable HTTP wrappers in an emulator-only Express harness, including Auth token verification and real Firestore emulator transactions. No production Firebase project, real staff accounts, real payments or actual restaurant printer were used.

Browser testing used Node 22 and Chromium. Tests do not prove Safari/Android device compatibility or deployed index/configuration correctness. Real Firebase provisioning, deployment, actual-device/printer checks, public-launch abuse protection and a supervised restaurant pilot remain required.

GitHub write access was reauthorized on 5 October 2026 and the release branch was created successfully. This update is submitted for PR review; no merge or production deployment has been performed.
