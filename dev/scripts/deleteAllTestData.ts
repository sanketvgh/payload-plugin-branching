import { getPayload } from 'payload'

import config from '../payload.config.js'

// One-off cleanup script. Run via:
//   pnpm dev:payload run dev/scripts/deleteAllTestData.ts
const run = async () => {
  const payload = await getPayload({ config })

  const posts = await payload.delete({ collection: 'posts', where: { id: { exists: true } } })
  payload.logger.info(`Deleted ${String(posts.docs.length)} posts`)

  const branches = await payload.delete({
    collection: 'payload-branches',
    where: { id: { exists: true } },
  })
  payload.logger.info(`Deleted ${String(branches.docs.length)} branches`)

  process.exit(0)
}

await run()
