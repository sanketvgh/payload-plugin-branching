---
'payload-plugin-branching': patch
---

Bootstrap release to establish a normal (non-prerelease) npm version, so future beta
publishes route to the `beta` dist-tag instead of `latest`. The plugin itself is still
early/non-functional; see the README warning.
