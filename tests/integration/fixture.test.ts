import type { Payload, PayloadRequest } from 'payload'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createLocalReq, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { projectResolvedBranchDocument } from '../../src/branches/projection.js'
import { parseCollectionDocumentID } from '../../src/contracts/documentID.js'
import { storedBranchSchema } from '../../src/contracts/storedBranch.js'
import { applyMerge } from '../../src/operations/applyMerge.js'
import { createBranch } from '../../src/operations/createBranch.js'
import { mergeBranch } from '../../src/operations/mergeBranch.js'
import { saveBranch } from '../../src/operations/saveBranch.js'

let fixtureRoot = ''
let payload: Payload | undefined

beforeAll(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), 'payload-branching-'))
  process.env['PAYLOAD_BRANCHING_TEST_ROOT'] = fixtureRoot

  const fixture = await import('../fixtures/payload.config.js')
  payload = await getPayload({ config: fixture.default })
})

afterAll(async () => {
  if (payload) {
    const databaseClient = Reflect.get(payload.db, 'client')
    const close =
      typeof databaseClient === 'object' && databaseClient !== null
        ? Reflect.get(databaseClient, 'close')
        : undefined

    if (typeof close === 'function') {
      Reflect.apply(close, databaseClient, [])
    }

    await payload.destroy()
  }

  delete process.env['PAYLOAD_BRANCHING_TEST_ROOT']

  const resolvedRoot = path.resolve(fixtureRoot)
  const resolvedTemp = path.resolve(tmpdir())

  if (
    path.dirname(resolvedRoot) !== resolvedTemp ||
    !path.basename(resolvedRoot).startsWith('payload-branching-')
  ) {
    throw new Error('Refusing to clean a path outside the disposable test directory')
  }

  await rm(resolvedRoot, {
    force: true,
    maxRetries: 10,
    recursive: true,
    retryDelay: 100,
  })
})

describe('isolated Payload fixture', () => {
  it('boots with an empty disposable database and the branching collection', async () => {
    if (!payload) {
      throw new Error('Payload fixture did not initialize')
    }

    const post = await payload.create({
      collection: 'posts',
      data: {
        title: 'Fixture post',
      },
    })

    expect(post['title']).toBe('Fixture post')
    expect(payload.collections['posts-branches']).toBeDefined()
  })

  it('discovers numeric and text collection ID types without coercing text IDs', () => {
    if (!payload) {
      throw new Error('Payload fixture did not initialize')
    }

    expect(parseCollectionDocumentID(payload, 'posts', '123')).toEqual({ id: 123, success: true })
    expect(parseCollectionDocumentID(payload, 'articles', '00123')).toEqual({
      id: '00123',
      success: true,
    })
  })

  it('projects frozen branch values under the current field permissions', async () => {
    if (!payload) {
      throw new Error('Payload fixture did not initialize')
    }

    await payload.create({
      collection: 'users',
      data: {
        email: 'editor@example.com',
        password: 'fixture-password',
        role: 'editor',
      },
    })

    const login = await payload.login({
      collection: 'users',
      data: { email: 'editor@example.com', password: 'fixture-password' },
    })

    if (!login.user) throw new Error('Fixture login did not return a user')
    const user: NonNullable<PayloadRequest['user']> = { ...login.user, collection: 'users' }
    const req = await createLocalReq({ user }, payload)
    const collection = payload.collections['posts']?.config

    if (!collection) throw new Error('Posts fixture collection is unavailable')

    const resolved = await projectResolvedBranchDocument({
      branchRow: {
        id: 1,
        baselineManifest: { secret: { captured: true }, title: { captured: true } },
        baselineSnapshot: { secret: 'hidden history', title: 'Visible title' },
        branch: 'feature',
        overrides: { secret: 'hidden override', title: 'Visible override' },
        parent: 1,
      },
      collection,
      parentId: 1,
      req,
    })

    expect(resolved).toEqual({ title: 'Visible override' })
  })

  it('persists hook-transformed overrides and removes values reverted to baseline', async () => {
    if (!payload) {
      throw new Error('Payload fixture did not initialize')
    }

    await payload.create({
      collection: 'users',
      data: {
        email: 'save-editor@example.com',
        password: 'fixture-password',
        role: 'editor',
      },
    })

    const login = await payload.login({
      collection: 'users',
      data: { email: 'save-editor@example.com', password: 'fixture-password' },
    })

    if (!login.user) throw new Error('Fixture login did not return a user')
    const user: NonNullable<PayloadRequest['user']> = { ...login.user, collection: 'users' }
    const req = await createLocalReq({ user }, payload)
    const post = await payload.create({
      collection: 'posts',
      data: { title: 'Baseline' },
      req,
    })

    await createBranch({
      branchName: 'save-lifecycle',
      collectionSlug: 'posts',
      createdBy: user.id,
      parentId: post.id,
      payload,
      req,
    })

    const changed = await saveBranch({
      branch: 'save-lifecycle',
      collectionSlug: 'posts',
      data: { title: '  Changed  ' },
      expectedRevision: 0,
      parentId: post.id,
      req,
    })
    const parsedChanged = storedBranchSchema.safeParse(changed.branch)

    expect(parsedChanged.success).toBe(true)
    if (parsedChanged.success) expect(parsedChanged.data.overrides['title']).toBe('Changed')
    expect(changed.resolvedDoc['title']).toBe('Changed')

    const reverted = await saveBranch({
      branch: 'save-lifecycle',
      collectionSlug: 'posts',
      data: { title: ' Baseline ' },
      expectedRevision: changed.branch.revision,
      parentId: post.id,
      req,
    })
    const parsedReverted = storedBranchSchema.safeParse(reverted.branch)

    expect(parsedReverted.success).toBe(true)
    if (parsedReverted.success)
      expect(Object.hasOwn(parsedReverted.data.overrides, 'title')).toBe(false)
    expect(reverted.resolvedDoc['title']).toBe('Baseline')
  })

  it('persists whole-field replacements for cleared group children and empty arrays', async () => {
    if (!payload) {
      throw new Error('Payload fixture did not initialize')
    }

    const login = await payload.login({
      collection: 'users',
      data: { email: 'save-editor@example.com', password: 'fixture-password' },
    })

    if (!login.user) throw new Error('Fixture login did not return a user')
    const user: NonNullable<PayloadRequest['user']> = { ...login.user, collection: 'users' }
    const req = await createLocalReq({ user }, payload)
    const post = await payload.create({
      collection: 'posts',
      data: { settings: { label: 'baseline', tags: [{ value: 'one' }] }, title: 'Atomic' },
      req,
    })

    await createBranch({
      branchName: 'atomic-replacements',
      collectionSlug: 'posts',
      createdBy: user.id,
      parentId: post.id,
      payload,
      req,
    })

    const cleared = await saveBranch({
      branch: 'atomic-replacements',
      collectionSlug: 'posts',
      data: { settings: { label: 'changed', tags: [] } },
      expectedRevision: 0,
      parentId: post.id,
      req,
    })

    expect(cleared.resolvedDoc['settings']).toEqual({ label: 'changed', tags: [] })

    const removedChild = await saveBranch({
      branch: 'atomic-replacements',
      collectionSlug: 'posts',
      data: { settings: {} },
      expectedRevision: cleared.branch.revision,
      parentId: post.id,
      req,
    })

    expect(removedChild.resolvedDoc['settings']).toEqual({})
  })

  it('applies a merge and rebaselines the branch', async () => {
    if (!payload) {
      throw new Error('Payload fixture did not initialize')
    }

    await payload.create({
      collection: 'users',
      data: {
        email: 'merge-editor@example.com',
        password: 'fixture-password',
        role: 'editor',
      },
    })

    const login = await payload.login({
      collection: 'users',
      data: { email: 'merge-editor@example.com', password: 'fixture-password' },
    })

    if (!login.user) throw new Error('Fixture login did not return a user')
    const user: NonNullable<PayloadRequest['user']> = { ...login.user, collection: 'users' }
    const req = await createLocalReq({ user }, payload)
    const post = await payload.create({
      collection: 'posts',
      data: { title: 'Main' },
      req,
    })

    await createBranch({
      branchName: 'apply-wiring',
      collectionSlug: 'posts',
      createdBy: user.id,
      parentId: post.id,
      payload,
      req,
    })
    await saveBranch({
      branch: 'apply-wiring',
      collectionSlug: 'posts',
      data: { title: 'Branch' },
      expectedRevision: 0,
      parentId: post.id,
      req,
    })

    const preview = await mergeBranch({
      branch: 'apply-wiring',
      collectionSlug: 'posts',
      parentId: post.id,
      payload,
      req,
    })
    const result = await applyMerge({
      branch: 'apply-wiring',
      collectionSlug: 'posts',
      parentId: post.id,
      picks: {},
      previewToken: preview.previewToken,
      req,
      revision: preview.revision,
    })

    expect(result.doc['title']).toBe('Branch')
    const stored = storedBranchSchema.safeParse(result.branch)

    expect(stored.success).toBe(true)
    if (stored.success) {
      expect(stored.data.baselineSnapshot['title']).toBe('Branch')
      expect(Object.hasOwn(stored.data.overrides, 'title')).toBe(false)
    }

    await payload.update({
      id: post.id,
      collection: 'posts',
      data: { title: 'Main after merge' },
      req,
    })

    const nextPreview = await mergeBranch({
      branch: 'apply-wiring',
      collectionSlug: 'posts',
      parentId: post.id,
      payload,
      req,
    })

    expect(nextPreview.baselineDoc['title']).toBe('Branch')
    expect(nextPreview.branchDoc['title']).toBe('Branch')
    expect(nextPreview.mainDoc['title']).toBe('Main after merge')
  })
})
