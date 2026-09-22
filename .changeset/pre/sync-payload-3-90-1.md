---
'payload-plugin-branching': patch
---

Verify and widen the supported Payload version range. CI now bisects real
Payload releases against the integration suite (`test/payload-version-matrix`)
to confirm the true minimum instead of guessing: `peerDependencies` moves from
`^3.84.1` to `^3.77.0`, the earliest version that actually works. Dev/test
tooling is bumped to the latest stable Payload (`3.90.1`) so CI keeps testing
against current releases independently of the published floor.
