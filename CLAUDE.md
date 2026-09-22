# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`payload-plugin-branching` is a [Payload CMS](https://payloadcms.com) plugin, published to npm, that adds
Git-like content branching: multiple named branches per document, edited in isolation, without affecting
main/default content until merged. Merge includes field-level three-way merge with conflict review (editor
picks branch vs. target per field), not just a fast-forward apply.

Status: early beta, published to npm under the `beta` dist-tag. API and stored data format may still change
before 1.0.

## Commands

- `pnpm dev`: run the `/dev` Payload test app (Next.js dev server)
- `pnpm dev:build` / `pnpm dev:start`: build/start the dev app in production mode
- `pnpm dev:generate-types`: regenerate `dev/payload-types.ts`
- `pnpm dev:migrate` / `pnpm dev:migrate:create`: Payload DB migrations for the dev app
- `pnpm build`: build the plugin into `dist` (clean, copy static assets, emit types, compile with swc)
- `pnpm lint` / `pnpm lint:fix`: ESLint (strict type-checked rules on `src/**/*.ts`)
- `pnpm typecheck`: `tsc --noEmit`
- `pnpm test`: full suite (`test:int` then `test:e2e`) — slow; prefer running only the file you touched locally
- `pnpm test:int`: `test:unit` (Vitest, no DB) + `test:integration` (Vitest, real Payload/DB)
- `pnpm test:e2e`: Playwright, run against a production build (see `.github/workflows/ci.yml`)
- `pnpm test:types`: type-check the test suite itself (`tsconfig.test.json`)
- `pnpm check:deadcode` / `pnpm check:duplication` / `pnpm check:exports`: Knip, jscpd, Publint gates run in CI
- `pnpm changeset` / `pnpm changeset:version` / `pnpm changeset:publish`: Changesets release flow (see Release below)

Pre-commit runs `lint-staged` (ESLint --fix + Prettier) via Husky.

## Architecture

- `src/index.ts`: the plugin entry, `payloadPluginBranching(options) => (config) => config`, Payload's standard
  plugin factory shape
- `src/collections/`: the branches collection definition
- `src/branches/`: branch value projection, field-level branch eligibility, revision handling
- `src/merge/threeWayMerge.ts`: field-level three-way merge (base/branch/target) that produces per-field
  conflicts for editor review
- `src/endpoints/`: custom REST endpoints (`createBranch`, `saveBranch`, `listBranches`, `resolveBranch`,
  `mergeBranch`, `applyMerge`)
- `src/views/`: admin UI for the merge/conflict-review screen (`BranchMergeView*`)
- `src/components/`: admin UI (branch switcher, create-branch modal)
- `src/operations/`, `src/utilities/`, `src/contracts/`: internal helpers and shared type contracts
- `src/lint/`: repo-specific lint rule (assertion-free gate), tested like any other unit under `src`
- `dev/`: sanitized Payload app for local dev/testing only, not published
- Published consumers resolve to `dist/` via `publishConfig.exports`

## Reference documentation

- Payload CMS docs (llms.txt): https://payloadcms.com/llms.txt. Consult this for current Payload APIs rather
  than relying on training data.
- Target Payload version: `^3.77.0` (`peerDependencies`/README floor). This is a verified minimum, not a
  guess: `test/payload-version-matrix` in `.github/workflows/ci.yml` bisects real Payload releases against the
  integration suite. `3.76.1` and earlier fail on missing exports (`sanitizeUrl`, `hasDraftsEnabled`,
  `getFieldByPath`, etc.); `3.77.0` onward pass. When bumping the floor, extend that matrix rather than
  guessing, and remember Payload requires every `@payloadcms/*` sibling package pinned to the same version as
  `payload` itself (its own dependency checker enforces this at runtime).
- Dev/test tooling (`devDependencies`) intentionally tracks a newer pinned version (currently `3.90.1`) than
  the published peer floor, so CI catches breakage against current Payload while the plugin still declares
  the widest honest compatibility range to consumers.

## Release process

- Versioning/publishing goes through [Changesets](https://github.com/changesets/changesets) via
  `.github/workflows/release.yml` (manual `workflow_dispatch`, modes `version-pr` and `publish`).
- The `next` branch runs in Changesets prerelease mode (`.changeset/pre.json`, tag `beta`); `main` publishes to
  the `latest` dist-tag. `latest` will lag behind `beta` until someone deliberately exits prerelease mode
  (`pnpm changeset pre exit` on `next`, merge to `main`, then a `publish` run) — that gap is expected, not a
  bug.
- `release.yml` already guards against a stray `pre.json` on `main` (would silently turn a prerelease into
  `latest` or vice versa).

## Scratch / proposal docs

- `.scratch/` holds personal proposal/planning docs that are not meant to be committed. It's
  gitignored. Write exploratory or proposal markdown there, not at the repo root, unless the
  user explicitly asks for a committed doc.

## Conventions

- Default to no comments. Only add a comment when the code cannot explain itself (a non-obvious constraint, a workaround, a subtle invariant), and keep it to one short line, never a paragraph.
- No em dashes in code, comments, commit messages, or docs. Use a comma, period, or parentheses instead.
- License: MIT.
- `payload` must be a `peerDependency`, not a regular dependency; every `@payloadcms/*` package used in dev/test must stay pinned to the same version as `payload` (see Reference documentation above).
- Package manager pinned via `packageManager` in `package.json` (Corepack-enforced); `.npmrc` sets `engine-strict=true`.
- ESLint's `strictTypeChecked`/`stylisticTypeChecked` apply to `src/**/*.ts`, with `eslint-config-prettier` last so formatting rules never collide with Prettier.
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org) with a leading [Gitmoji](https://gitmoji.dev), e.g. `✨ feat: add branch collection`, `🐛 fix: resolve default branch fallback`. No AI/Claude Code attribution in commit messages.
