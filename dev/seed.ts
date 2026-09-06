import type { Payload } from 'payload'

import { devUser } from './helpers/credentials.js'

export const seed = async (payload: Payload) => {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: {
      email: {
        equals: devUser.email,
      },
    },
  })

  if (!totalDocs) {
    await payload.create({
      collection: 'users',
      data: devUser,
    })
  }

  // Alpha/beta branch demo seeding, disabled for now.
  // const { totalDocs: seededBranchDemoCount } = await payload.count({
  //   collection: 'payload-branches',
  //   where: {
  //     name: {
  //       equals: 'alpha',
  //     },
  //   },
  // })
  //
  // if (!seededBranchDemoCount) {
  //   const post = await payload.create({
  //     collection: 'posts',
  //     data: { content: 'Base content (default branch)' },
  //   })
  //
  //   const alphaBranch = await payload.create({
  //     collection: 'payload-branches',
  //     data: { name: 'alpha' },
  //   })
  //
  //   const betaBranch = await payload.create({
  //     collection: 'payload-branches',
  //     data: { name: 'beta' },
  //   })
  //
  //   await payload.update({
  //     id: post.id,
  //     collection: 'posts',
  //     data: { content: 'Alpha branch content' },
  //     req: {
  //       headers: new Headers([['cookie', `payload-branch=${String(alphaBranch.id)}`]]),
  //     },
  //   })
  //
  //   await payload.update({
  //     id: post.id,
  //     collection: 'posts',
  //     data: { content: 'Beta branch content' },
  //     req: {
  //       headers: new Headers([['cookie', `payload-branch=${String(betaBranch.id)}`]]),
  //     },
  //   })
  // }
}
