# Branching for Payload

**A place to work on the next version.**

Named content branches for [Payload CMS](https://payloadcms.com). Edit a document in isolation, compare it with main, and merge when you're ready.

[![Payload 3](https://img.shields.io/badge/Payload-3-black)](https://payloadcms.com)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

```text
main           ●──────────────────────●
                ╲                    ╱
summer-rewrite   ●─────●─────●───────╯
                   edit   review   merge
```

A post needs a new introduction. Create `summer-rewrite`, try a few versions, and leave main alone. Someone fixes a typo on main while you work? The merge compares both versions with the content you started from. Separate changes come together automatically. If you both changed the same field, you choose which version to keep.

> [!WARNING]
> ⚠️ Early beta. The API and stored data format may change before 1.0. Not yet recommended for production; back up your data before trying it.

## Branch and edit

Create, browse, edit, review, and merge branches inside the Payload admin.

- **Multiple alternatives per document.** Give each branch a unique name, such as `shorter-intro` or `summer-rewrite`. Each keeps its starting content and its own edits, even when main changes later.
- **Saved or published starting content.** The admin creates branches from main's saved content, including a saved draft. The creation endpoint also accepts `copyFrom: 'published'` to start from the published version when one exists. Unsaved form edits aren't included.
- **The same document editor.** Use the collection's fields, validation, required-field rules, and field editing permissions. Branch saves leave main untouched.
- **A switcher on the document.** Browse its branches, switch back to main, and see which branch has changes. Longer branch lists are supported, with a retry if loading fails.
- **Choose where branching is available.** Enable it for selected collections, or set `disabled: true` in the plugin options to disable the plugin.

## Review and merge

Choose **Merge [branch name] into main** to open the review. The comparison uses the content the branch started from, current main, and your branch.

| What changed?                    | What happens at merge        |
| -------------------------------- | ---------------------------- |
| Only the branch changed a field  | Take the branch value.       |
| Only main changed a field        | Keep main's value.           |
| Both made the same change        | Keep the shared value.       |
| Both changed a field differently | Ask you which value to keep. |

For conflicts, choose main or branch one field at a time, or choose one side for all conflicts. The review tracks your progress and asks for confirmation before applying anything.

You can inspect grouped fields, lists, blocks, linked content, and supported rich-text differences. Conflict choices still apply to whole top-level fields. Changes without conflicts are listed by field and source; they don't yet have the same detailed comparison display.

The merge follows Payload's normal document update rules, including validation, access checks, document locks, hooks, and versions where enabled. Afterward, the branch stays available. Merged fields become its new starting point, so you can continue working on it.

**Merging can change published content if main is published.** The document keeps its existing publication status; merging is not a separate publishing step.

## Access and save protection

Signed-in users see branch content according to their current document and field permissions. Branch storage stays internal; there is no separate branch-role or private-sharing system yet.

- **Outdated saves are rejected.** If another save has changed the branch since you loaded it, your save is rejected instead of accepting the old revision.
- **Outdated reviews need another look.** If main or the branch changes after review, the merge is rejected until you refresh the comparison.
- **The latest merge can be retried.** An unchanged retry of the most recently completed merge is recognized without applying it again. This doesn't cover every historical merge.
- **Related merge writes stay together on supported setups.** With database transactions enabled and supported, the main update and branch merge record succeed or fail together. A rollback can't undo emails or webhooks already triggered by hooks.

Revision checks do not yet guarantee protection against two saves or merges arriving at the same time. Those writes can still overwrite one another.

## Add it to your project

```sh
pnpm add payload-plugin-branching@beta
```

Add this to the plugins in your existing Payload config:

```ts
import { payloadPluginBranching } from 'payload-plugin-branching'

// Inside buildConfig({ plugins: [...] })
payloadPluginBranching({
  collections: {
    posts: true,
    pages: true,
  },
})
```

Use your own collection slugs. Each enabled collection gets a branch switcher and a hidden `<slug>-branches` collection. Generate and apply a database migration if your project uses migrations, and regenerate the admin import map if your setup doesn't do it automatically.

Requires Payload `^3.84.1`, Node `^18.20.2 || >=20.9.0`, and an auth collection named `users`.

## Try it

Open a saved document, choose **New branch** from the switcher, and name it. You're still in the same editor, with the same fields and validation. Save as often as you need. Those edits stay on the branch.

When you're ready, open the merge review, resolve any conflicts, and confirm. You can return to the branch for the next round of edits.

## Before using it

This release covers branching and merging individual documents in the admin. It doesn't yet include website previews, approvals, globals, or releases spanning multiple documents.

<details>
<summary>Editing and merge limits</summary>

- Conflict choices apply to whole top-level fields. A rich-text body or blocks list is taken from one side in full. Localized fields are also merged together across all locales.
- Existing media can be selected. File uploads through branch saves aren't supported.
- Adding collection fields after creating a branch can prevent editing or merging it. Recreate the branch in that case.

</details>

<details>
<summary>Branch storage and cleanup</summary>

- Find and switch branches from the document editor. There is no separate branch management screen yet; the hidden `<slug>-branches` collections are internal storage.
- Branches cannot yet be renamed, archived, or deleted through the plugin. Branch history and restore aren't available either.
- Branch creation checks the size of its starting snapshot and reports when it exceeds the limit, which defaults to 1 MB. Set `collection.custom.branchSnapshotMaxBytes` to change it. Automatic cleanup and retention policies aren't available yet.

</details>

---

[MIT](./LICENSE) · [Report a bug](https://github.com/sanketvgh/payload-plugin-branching/issues)
