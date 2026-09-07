import { getPayload } from 'payload'

import config from '../payload.config.js'

// One-off demo seed. Run via:
//   pnpm dev:payload run dev/scripts/seedDemoBranches.ts
const run = async () => {
  const payload = await getPayload({ config })

  const alpha = await payload.create({ collection: 'payload-branches', data: { name: 'alpha' } })
  const beta = await payload.create({ collection: 'payload-branches', data: { name: 'beta' } })

  const alphaSub = await payload.create({
    collection: 'payload-branches',
    data: { name: 'alpha-sub', parentBranch: alpha.id },
  })
  const betaSub = await payload.create({
    collection: 'payload-branches',
    data: { name: 'beta-sub', parentBranch: beta.id },
  })

  const main = await payload.create({
    collection: 'posts',
    data: { content: 'This is the shared Default content, visible on every branch.', title: 'Main' },
  })

  const asBranch = (id: number | string) => ({
    headers: new Headers([['cookie', `payload-branch=${String(id)}`]]),
  })

  const alphaPost1 = await payload.create({
    collection: 'posts',
    data: { content: 'Alpha-only content, post 1.', title: 'Alpha post 1' },
    req: asBranch(alpha.id),
  })
  const alphaPost2 = await payload.create({
    collection: 'posts',
    data: { content: 'Alpha-only content, post 2.', title: 'Alpha post 2' },
    req: asBranch(alpha.id),
  })

  const betaPost1 = await payload.create({
    collection: 'posts',
    data: { content: 'Beta-only content, post 1.', title: 'Beta post 1' },
    req: asBranch(beta.id),
  })
  const betaPost2 = await payload.create({
    collection: 'posts',
    data: { content: 'Beta-only content, post 2.', title: 'Beta post 2' },
    req: asBranch(beta.id),
  })

  payload.logger.info(
    `Seeded: branches alpha(${String(alpha.id)}, sub ${String(alphaSub.id)}), beta(${String(beta.id)}, sub ${String(betaSub.id)}); posts main(${String(main.id)}), alpha[${String(alphaPost1.id)}, ${String(alphaPost2.id)}], beta[${String(betaPost1.id)}, ${String(betaPost2.id)}]`,
  )

  process.exit(0)
}

await run()
