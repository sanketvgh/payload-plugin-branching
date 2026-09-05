import type { Payload } from 'payload'

import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('Plugin integration tests', () => {
  test('adds the Greeting component before the dashboard', () => {
    expect(payload.config.admin?.components?.beforeDashboard).toContain(
      'payload-plugin-branching/rsc#Greeting',
    )
  })

  test('boots with the dev collections available', async () => {
    const post = await payload.create({
      collection: 'posts',
      data: {},
    })

    expect(post.id).toBeDefined()
  })
})
