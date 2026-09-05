# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`payload-plugin-branching` is a [Payload CMS](https://payloadcms.com) plugin, to be distributed as an npm package, that adds Git-like content branching: multiple named branches per document, edited in isolation, without affecting the default/live content until switched.

## Commands

- `pnpm dev`: run the `/dev` Payload test app
- `pnpm build`: build the plugin into `dist`
- `pnpm lint` / `pnpm lint:fix`: ESLint (strict type-checked rules on `src/**/*.ts`)
- `pnpm test` / `pnpm test:int` / `pnpm test:e2e`: Vitest + Playwright
- `pnpm dev:generate-types`: regenerate `dev/payload-types.ts`

Pre-commit runs `lint-staged` (ESLint --fix + Prettier) via Husky.

## Architecture

- `src/index.ts`: the plugin, `payloadPluginBranching(options) => (config) => config`, Payload's standard plugin factory shape
- `dev/`: sanitized Payload app for local dev/testing only, not published
- Published consumers resolve to `dist/` via `publishConfig.exports`

## Reference documentation

- Payload CMS docs (llms.txt): https://payloadcms.com/llms.txt. Consult this for current Payload APIs rather than relying on training data.
- Target Payload version: `^3.0.0`.

## Scratch / proposal docs

- `.scratch/` holds personal proposal/planning docs that are not meant to be committed. It's
  gitignored. Write exploratory or proposal markdown there, not at the repo root, unless the
  user explicitly asks for a committed doc.

## Conventions

- Default to no comments. Only add a comment when the code cannot explain itself (a non-obvious constraint, a workaround, a subtle invariant), and keep it to one short line, never a paragraph.
- No em dashes in code, comments, commit messages, or docs. Use a comma, period, or parentheses instead.
- License: MIT.
- `payload` must be a `peerDependency`, not a regular dependency.
- No merge functionality for now, branching/isolation only.
- Package manager pinned via `packageManager` in `package.json` (Corepack-enforced); `.npmrc` sets `engine-strict=true`.
- ESLint's `strictTypeChecked`/`stylisticTypeChecked` apply to `src/**/*.ts`, with `eslint-config-prettier` last so formatting rules never collide with Prettier.
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org) with a leading [Gitmoji](https://gitmoji.dev), e.g. `✨ feat: add branch collection`, `🐛 fix: resolve default branch fallback`. No AI/Claude Code attribution in commit messages.
