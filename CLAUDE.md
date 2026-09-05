# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`payload-plugin-branching` is a [Payload CMS](https://payloadcms.com) plugin, to be distributed as an npm package, that adds Git-like content branching: multiple named branches per document, edited in isolation, without affecting the default/live content until switched.

## Reference documentation

- Payload CMS docs (llms.txt): https://payloadcms.com/llms.txt — consult this for current Payload APIs rather than relying on training data.
- Target Payload version: `^3.0.0`.

## Conventions

- License: MIT.
- `payload` must be a `peerDependency`, not a regular dependency.
- No merge functionality for now — branching/isolation only.
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org) with a leading [Gitmoji](https://gitmoji.dev), e.g. `✨ feat: add branch collection`, `🐛 fix: resolve default branch fallback`. No AI/Claude Code attribution in commit messages.
