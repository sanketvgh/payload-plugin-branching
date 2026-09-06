import { getPayload } from 'payload'

import config from '../payload.config.js'

// One-off backfill after adding the required `title` field to posts:
// the migration defaulted existing rows to 'Untitled', this gives them
// distinct, readable titles for the demo. Run via:
//   pnpm dev:payload run dev/scripts/backfillPostTitles.ts
const run = async () => {
  const payload = await getPayload({ config })

  const { docs: posts } = await payload.find({
    collection: 'posts',
    depth: 0,
    limit: 100,
  })

  for (const post of posts) {
    const branchName = post.branch && typeof post.branch === 'object' ? post.branch.name : 'default'
    const title = post.canonicalId
      ? `Post ${String(post.canonicalId)} (${branchName})`
      : `Post ${String(post.id)}`

    await payload.update({
      id: post.id,
      collection: 'posts',
      data: { title },
    })

    payload.logger.info(`Post ${String(post.id)}: title set to "${title}"`)
  }

  process.exit(0)
}

await run()
