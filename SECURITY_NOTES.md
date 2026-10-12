# Dependency review — 12 October 2026

QuickDine 0.3.1 updates Firebase CLI to 15.33.0, Admin SDK to 14.5.0 and Functions SDK to 7.4.0. Supported frontend tooling dependencies are refreshed within their existing ranges. The root project supports Node 22.12+ and Node 24; deployed Cloud Functions keep the Node 22 runtime.

The reported node-tar critical extraction vulnerabilities are removed by the CLI update. Targeted overrides use patched OpenTelemetry Core 2.8+, basic-ftp 6.2.3+ and the CommonJS-compatible uuid 11.1.1+. Gaxios uses uuid.v4(), which remains available. The application build, actual callable integration and browser workflows are rechecked after these changes.

| Audit scope | Result |
| --- | --- |
| Browser production dependencies (`npm audit --omit=dev`) | 0 findings |
| Server (`npm audit --prefix functions`) | 0 findings |
| All root dependencies including CLI/test tooling | 3 high, 0 critical |

The remaining high reports are `braces`, `chokidar` and their parent `firebase-tools`, from GHSA-vfj7-8cjw-p6xm. The latest upstream braces release available during this review is still 3.0.3 and is affected. npm's forced remediation proposes an older Firebase CLI, so it is not applied. QuickDine does not import these watcher/glob packages in its browser build or deployed callable server; their dependency path is development/deployment tooling. This limits exposure in this application, but does not establish that the dependency itself is generally safe. Follow an upstream patched release rather than replacing glob APIs across major versions blindly.

CI blocks production/server audit findings at moderate or above and root critical findings, alongside functional checks. Audits are time-sensitive; rerun before deployment. This review does not enable Firebase billing, configure merchant credentials or deploy the production project.
