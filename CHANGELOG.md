# payload-plugin-branching

## 0.2.0-beta.2

### Patch Changes

- d60d795: Verify and widen the supported Payload version range. CI now bisects real
  Payload releases against the integration suite (`test/payload-version-matrix`)
  to confirm the true minimum instead of guessing: `peerDependencies` moves from
  `^3.84.1` to `^3.77.0`, the earliest version that actually works. Dev/test
  tooling is bumped to the latest stable Payload (`3.90.1`) so CI keeps testing
  against current releases independently of the published floor.

## 0.2.0-beta.1

### Minor Changes

- 28dbaeb: Add named content branching: create, edit and switch between branches per document in isolation from main, with revision-checked saves, a branch switcher and create-branch UI, and field-level three-way merge with conflict review to apply a branch back onto its target.

## 0.1.1-beta.0

### Patch Changes

- d13a418: Add a warning emoji to the README status warning for visibility.

## 0.1.0

### Minor Changes

- 12c9272: Initial beta scaffolding.

### Patch Changes

- becae1e: Bootstrap release to establish a normal (non-prerelease) npm version, so future beta
  publishes route to the `beta` dist-tag instead of `latest`. The plugin itself is still
  early/non-functional; see the README warning.
- 5dbb31a: Add a warning to the README that the plugin is not yet functional.

## 0.1.0-beta.1

### Patch Changes

- 5dbb31a: Add a warning to the README that the plugin is not yet functional.

## 0.1.0-beta.0

### Minor Changes

- 12c9272: Initial beta scaffolding.
