# Branching plugin: session handoff

Working notes from the first implementation pass on `feat/branching`, so context isn't
lost between sessions. This is a snapshot, not permanent documentation — fold anything
still true into `README.md`/`CLAUDE.md` once the design settles, and delete this file.

## What exists right now

### Data model

- **`payload-branches`** (`src/collections/branches.ts`): `name` (text, required, unique),
  `parentBranch` (self-relationship, optional). A branch is a pure pointer — creating one
  never touches existing documents (O(1), Neon-style).
- **`payload-branch-closure`** (`src/collections/branchClosure.ts`): `ancestor`,
  `descendant` (relationships to `payload-branches`), `depth` (number). A closure table
  (TypeORM-style) giving O(1) "full ancestor chain, nearest first" lookups instead of
  recursive parent-walking. Maintained by an `afterChange` hook on `payload-branches`
  (create op only): inserts a self-row `(branch, branch, 0)` plus one row per
  ancestor-of-parent copied at `depth + 1`. A `beforeDelete` hook on `payload-branches`
  removes all closure rows referencing the deleted branch first (SQLite FK columns here
  are `NOT NULL`, so without this cleanup, deleting a branch throws a constraint error).
- **Injected fields** on every collection listed in `pluginOptions.collections`:
  - `branch` (`src/fields/branchField.ts`): relationship to `payload-branches`, hidden
    from create/edit UI, sidebar-only. **No `defaultValue`** — new documents always land
    on the default branch (`branch: null`) regardless of which branch is active at
    creation time. This was a deliberate design decision made mid-session (see "Design
    decisions" below); only _edits_ diverge, not creates.
  - `canonicalId` (`src/fields/canonicalIdField.ts`): hidden text field. Only ever set on
    diverged rows, pointing back at the original/base row's `id`. Base rows leave it null.

### Copy-on-write divergence (the actual "branching" mechanism)

- **`src/hooks/redirectUpdateToBranch.ts`** (`beforeOperation`, `operation === 'update'`
  with `id` present — this is Payload's `updateByID`, not bulk `update`, see gotcha
  below): if the active branch (from the `payload-branch` cookie) differs from the
  document's own `branch` field, redirects the write into a new or existing
  branch-scoped row instead of mutating the original. The base/default row is never
  touched by an edit made while a branch is active.
- **`src/hooks/redirectReadToBranch.ts`** (`beforeOperation`, `operation === 'read'` with
  `id` present — this is `findByID`, not bulk `find`): if there's an active branch,
  resolves its full ancestry via `getBranchAncestry` and transparently redirects the
  lookup to the nearest ancestor branch's diverged row if one exists, falling back to the
  originally requested (base) row otherwise.
- **Known, deliberate limitation**: this only works for single-document reads
  (`findByID`). List queries (`payload.find`, including the admin list view) do **not**
  do per-document branch-fallback resolution — a list shows raw rows, including both a
  base row and any diverged rows for the same logical document side by side once
  something has diverged. Deduping a paginated multi-doc query by `canonicalId` was
  explicitly scoped out as a harder problem. The dev app's homepage works around this by
  filtering to `branch: { exists: false }` so it only ever links into canonical entry
  points (see "Bugs found and fixed" below for why this mattered).

### Active branch tracking

- Cookie-based (`payload-branch`), not session/DB state — mirrors
  `@payloadcms/plugin-multi-tenant`'s `payload-tenant` cookie pattern exactly, and for
  the same reason: a cookie is ambient, the browser attaches it to every request
  automatically, so the admin panel, REST API, and any custom frontend all see the active
  branch without each needing branch-awareness built in individually.
- `src/utilities/getBranchFromCookie.ts` / `generateBranchCookie.ts`: read/write the
  cookie. Coerces the value to the branch collection's actual ID type (via
  `getCollectionIDType.ts`) — **this bit us once already**, see gotchas.
- **Gotcha for consumers**: Payload's local API does **not** auto-forward the real
  incoming HTTP request's cookies into `beforeOperation` hooks. Any server code calling
  `payload.findByID`/`payload.update` from within a real request handler (a Next.js
  server component, a route handler, a seed script simulating a branch) must manually
  build `req: { headers: <Headers with the cookie> }` and pass it explicitly. See
  `dev/app/(frontend)/posts/[id]/page.tsx` for the `next/headers` pattern, and
  `dev/int.spec.ts` / `dev/seed.ts` for the local-API-with-fake-cookie pattern used in
  tests and seeding.

### Admin UI scoping

- `admin.baseFilter` (`src/filters/filterDocumentsByBranch.ts`), wired via a
  non-destructive `combineFilters` merge (never overwrites an existing `baseFilter`) —
  only affects the admin panel's **List view** rendering
  (`packages/next/src/views/List/index.tsx` in Payload's own source), not local API/REST
  calls generally. Filters to `{ or: [{ branch: { in: [active, ...ancestry] } },
{ branch: { exists: false } }] }` — the `exists: false` half is required so
  never-diverged (inherited) documents don't disappear from the list the moment any
  branch is active (this was Bug #2 below).
- No `access[create|read|update|delete|readVersions|unlock]` control wiring yet — only
  the list-view filter exists. Real access-control enforcement (so a REST/GraphQL client
  can't bypass branch scoping outside the admin UI) is still unimplemented.

### Dev app demo (`dev/`)

- `posts` collection, `content` textarea field, plugin wired with
  `collections: { posts: true }`.
- `dev/app/(frontend)/page.tsx`: lists canonical posts only (`branch: { exists: false }`
  filter — see Bug #3), links to `/posts/[id]`.
- `dev/app/(frontend)/posts/[id]/page.tsx`: forwards the real request's cookies into
  `findByID`, renders resolved content, shows a `<BranchSwitcher>` dropdown.
- `dev/app/(frontend)/components/BranchSwitcher.tsx`: client component, posts the chosen
  branch id to `/api/branch`, then `router.refresh()`.
- `dev/app/(frontend)/api/branch/route.ts`: sets/clears the `payload-branch` cookie via
  `generateBranchCookie`/`branchCookieName` (both now exported from the plugin's public
  `.` entry, added specifically for this route to consume).
- `dev/seed.ts`: only seeds the dev user currently. The alpha/beta demo-data block (base
  post + two branches + two divergent edits) was written, then **commented out** at the
  user's request — it's still in the file, ready to re-enable, but not running.
- **Migrations, not push**: `dev/payload.config.ts`'s `sqliteAdapter` now has `push:
false` and an explicit `migrationDir: dev/migrations`. Initial migration already
  generated and committed at `dev/migrations/20260906_073705_initial.{ts,json}`. **Any
  future collection/field change requires manually running
  `pnpm dev:payload migrate:create <name>` then `pnpm dev:payload migrate` before `pnpm
dev` will see it** — it no longer auto-syncs the schema.

## Design decisions made this session (don't re-litigate without reason)

1. **Collection-level, one global active branch at a time** (git-checkout style), not
   per-document. Confirmed explicitly via user choice early in the session.
2. **No merge** — branches are created, edited in isolation, switched to; per
   `CLAUDE.md`'s existing constraint, not something introduced this session.
3. **New documents always land on the default branch**, never on whatever branch happens
   to be active at creation time. Only _edits_ diverge. Confirmed explicitly via user
   choice after Bug #3 (below) surfaced the alternative's confusing behavior. This is the
   opposite of `branchField`'s first implementation, which defaulted new docs to the
   active branch (copying `@payloadcms/plugin-multi-tenant`'s `tenantField` pattern
   uncritically — tenants and branches don't have the same inheritance semantics, this
   was a real mismatch, not just a preference).
4. Reference architecture sources, in case a design question comes up again:
   - **Neon's branching model** (zero-copy pointer branches, copy-on-write divergence) —
     the semantic model for what a "branch" is.
   - **TypeORM's closure-table pattern** — the SQL structure for O(1) ancestry lookups,
     chosen specifically for portability across Payload's Mongo/Postgres/SQLite
     adapters (no recursive CTEs, no Postgres-only `ltree`/`DISTINCT ON` tricks).
   - **`@payloadcms/plugin-multi-tenant`** source (cloned at
     `.scratch/references/payloadcms`, tag `v3.84.1`, gitignored, pull it again if
     needed) — the scaffolding for how to hook into Payload's config: field injection,
     cookie-based active context, `admin.baseFilter`/`access` wiring via non-destructive
     merges. Read this before inventing new wiring patterns; it's almost certainly
     already solved a similar problem there.
   - `https://git-scm.com/docs` — general reference for which git concepts to consider
     modeling (stored in this session's memory, not a file).

## Bugs found and fixed this session (root causes, not just symptoms)

1. **Branch deletion failed** with a SQLite `NOT NULL` constraint error. Root cause:
   `payload-branch-closure`'s `ancestor`/`descendant` columns are `NOT NULL`, but
   Payload's relationship-field FK default is `ON DELETE SET NULL`, not `CASCADE` or
   `RESTRICT`. Fixed with the `beforeDelete` hook on `payload-branches` mentioned above.
2. **Posts disappeared from the admin list entirely the moment any branch was active.**
   Root cause: `filterDocumentsByBranch` only matched `branch: { in: [...ancestry] }`,
   and a never-diverged post has `branch: null`, which never matches an `in` list. Fixed
   by OR-ing in `branch: { exists: false }`.
3. **A specific diverged row's own detail page never changed when switching branches** —
   user saw `/posts/2` (an alpha-diverged row) show "changed for alpha only" regardless
   of the dropdown. Root cause: `redirectReadToBranch` only redirects _away_ from a
   requested id when a branch is active; it never redirects a diverged row's own id
   _back_ to something else. Visiting a diverged row's id directly is a dead end by
   design — it's not a bug in the hook, it's a UX bug in the dev app for linking into raw
   rows instead of canonical ones. Fixed by filtering the homepage's list query to
   `branch: { exists: false }` so it only ever links into canonical/base posts.
4. **`getBranchFromCookie` always returned a string**, but SQLite's `payload-branches`
   uses numeric IDs — assigning a string to a numeric relationship field failed
   validation. Root cause: the `idType` coercion that
   `@payloadcms/plugin-multi-tenant`'s equivalent (`getTenantFromCookie`) does was
   dropped when adapting the pattern. Fixed by adding `getCollectionIDType.ts` and
   threading `idType` through every call site.
5. **`redirectReadToBranch`'s ancestor-fallback silently failed beyond one hop** (root →
   child → grandchild chains). Root cause: comparing `canonicalId` (a string field)
   against `args.id` (a raw number) with no coercion — silently matched zero rows.
   Fixed with `String(args.id)`.
6. **A latent operation-string collision**: Payload's bulk `update`/`find` operations
   fire `beforeOperation` with the _same_ `operation` string (`'update'`/`'read'`) as
   `updateByID`/`findByID`, but their args have no singular `id` field. Both hooks now
   guard on `'id' in args` to discriminate — verified against the pinned Payload source
   (`packages/payload/src/collections/operations/{update,updateByID,find,findByID}.ts`),
   not guessed. Without this guard, a plain `payload.find({ collection: 'posts' })` list
   query on the homepage would silently misfire the read-redirect hook.

## Verified state as of last check

- `pnpm lint`: clean on `src/` (only pre-existing `any`-usage warnings in
  `dev/int.spec.ts`, which is outside `strictTypeChecked`'s scope).
- `npx tsc --noEmit -p .`: clean.
- `pnpm test:int` (`dev/int.spec.ts`, 14 tests): all passing, covering closure-table
  correctness across a 3-level branch chain, copy-on-write divergence on write (base row
  untouched, diverged row created/reused correctly), read-side ancestor fallback beyond
  depth 1, and the bulk-operation regression (#6 above).
- Manually verified end-to-end over real HTTP (not just local API scripts) against a
  freshly restarted dev server: branch creation, post creation landing on default, PATCH
  under an active branch cookie creating a diverged row while leaving the base row
  untouched, and `GET` on the same id resolving differently with vs. without the cookie.

## Open work / not yet done

- **No `access` control wiring.** Only the admin list-view filter exists; a REST/GraphQL
  client bypassing the admin UI is not currently scoped to a branch at all.
- **List-view dedup by `canonicalId`** is unsolved — diverged rows show up as separate
  list entries next to their base row. Not attempted this session; flagged as
  significantly harder than the single-document case (needs post-query dedup across
  pagination).
- **No admin-panel-native branch switcher.** The only UI for setting the active branch
  cookie lives in the dev app's custom frontend (`BranchSwitcher.tsx`), not inside
  `/admin` itself. Multi-tenant's plugin ships a `TenantSelector` admin component
  (`@payloadcms/plugin-multi-tenant/rsc#TenantSelector`, wired via
  `admin.components.beforeNav`) — worth mirroring if an in-admin switcher is wanted.
- **Deleting a branch with descendants or diverged content on it** isn't handled beyond
  cleaning up its own closure rows — child branches and diverged rows tied to a deleted
  branch become orphaned (still queryable by id, no longer reachable via
  branch-switching). No reparenting or cascade behavior implemented or decided.
- **Alpha/beta demo seed data** is written but commented out in `dev/seed.ts` — re-enable
  by uncommenting if a quick demo dataset is wanted again.
- **`pnpm dev:build`/`start` scripts don't exist** for the dev app specifically; asked
  about this at the end of the session, answered with the raw `npx next build dev`
  invocation, no script was added.
- Every plugin source change requires a **full dev server restart** (not hot-reload) to
  take effect, since Payload's config/hooks are built once at boot — this caused real
  confusion mid-session (Bug #3 investigation initially looked like a regression before
  realizing the running server was stale).
