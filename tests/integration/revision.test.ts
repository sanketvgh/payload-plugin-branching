import type { Payload, PayloadRequest } from 'payload'

import { ValidationError } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { applyMerge, OperationConflictError } from '../../src/operations/applyMerge.js'
import { createBranch } from '../../src/operations/createBranch.js'
import { mergeBranch } from '../../src/operations/mergeBranch.js'
import { saveBranch } from '../../src/operations/saveBranch.js'
import { bootFixture, editorRequest, type Fixture, teardownFixture } from './harness.js'

let fixture: Fixture | undefined
let payload: Payload
let req: PayloadRequest
let counter = 0

const seed = async () => {
  counter += 1
  const branch = `revision-${String(counter)}`
  const post = await payload.create({ collection: 'posts', data: { title: 'Main' }, req })

  const created = await createBranch({
    branchName: branch,
    collectionSlug: 'posts',
    createdBy: req.user?.id ?? '',
    parentId: post.id,
    payload,
    req,
  })

  return { branch, created, post }
}

const save = (branch: string, parentId: number | string, title: string, expectedRevision: number) =>
  saveBranch({ branch, collectionSlug: 'posts', data: { title }, expectedRevision, parentId, req })

const afterChangeCount = { value: 0 }

beforeAll(async () => {
  fixture = await bootFixture()
  payload = fixture.payload
  req = await editorRequest(payload, 'revision-editor@example.com')
  payload.collections['posts']?.config.hooks.afterChange.push(({ doc }) => {
    afterChangeCount.value += 1

    return doc
  })
})

afterAll(async () => {
  await teardownFixture(fixture)
})

describe('branch revision contract', () => {
  it('returns the parent document metadata unchanged after a branch save', async () => {
    const { branch, post } = await seed()

    const saved = await save(branch, post.id, 'Edited on branch', 0)
    const parent = await payload.findByID({ id: post.id, collection: 'posts', draft: true, req })

    expect(saved.parentMetadata).toMatchObject({ id: post.id, updatedAt: parent['updatedAt'] })
    expect(saved.resolvedDoc).not.toHaveProperty('updatedAt')
  })

  it('starts at zero and increments on every save', async () => {
    const { branch, created, post } = await seed()

    expect(created.revision).toBe(0)

    const first = await save(branch, post.id, 'One', 0)

    expect(first.branch.revision).toBe(1)

    const second = await save(branch, post.id, 'Two', 1)

    expect(second.branch.revision).toBe(2)
  })

  it('rejects the second of two saves made from the same revision', async () => {
    const { branch, post } = await seed()

    await save(branch, post.id, 'Editor A', 0)

    await expect(save(branch, post.id, 'Editor B', 0)).rejects.toMatchObject({
      code: 'STALE_BRANCH',
      data: { currentRevision: 1 },
      status: 409,
    })

    const resolved = await mergeBranch({
      branch,
      collectionSlug: 'posts',
      parentId: post.id,
      payload,
      req,
    })

    expect(resolved.branchDoc['title']).toBe('Editor A')
  })

  it('invalidates a merge preview when the branch is saved afterwards', async () => {
    const { branch, post } = await seed()

    await save(branch, post.id, 'Before preview', 0)

    const preview = await mergeBranch({
      branch,
      collectionSlug: 'posts',
      parentId: post.id,
      payload,
      req,
    })

    await save(branch, post.id, 'After preview', 1)

    await expect(
      applyMerge({
        branch,
        collectionSlug: 'posts',
        parentId: post.id,
        picks: {},
        previewToken: preview.previewToken,
        req,
        revision: preview.revision,
      }),
    ).rejects.toThrow('stale')
  })
})

describe('merge apply replay', () => {
  it('acknowledges a retried operation without running target hooks again', async () => {
    const { branch, post } = await seed()

    await save(branch, post.id, 'Branch value', 0)

    const preview = await mergeBranch({
      branch,
      collectionSlug: 'posts',
      parentId: post.id,
      payload,
      req,
    })
    const args = {
      branch,
      collectionSlug: 'posts',
      operationId: 'op-1',
      parentId: post.id,
      picks: {},
      previewToken: preview.previewToken,
      req,
      revision: preview.revision,
    }

    const first = await applyMerge(args)
    const hooksAfterFirst = afterChangeCount.value
    const retry = await applyMerge(args)

    expect(first.replayed).toBe(false)
    expect(retry.replayed).toBe(true)
    expect(retry.doc['title']).toBe('Branch value')
    expect(retry.branch.revision).toBe(first.branch.revision)
    expect(afterChangeCount.value).toBe(hooksAfterFirst)
  })

  it('rejects the same operation ID with different picks', async () => {
    const { branch, post } = await seed()

    await save(branch, post.id, 'Branch value', 0)
    await payload.update({ id: post.id, collection: 'posts', data: { title: 'Main value' }, req })

    const preview = await mergeBranch({
      branch,
      collectionSlug: 'posts',
      parentId: post.id,
      payload,
      req,
    })

    expect(preview.contested.map((unit) => unit.key)).toEqual(['title'])

    const base = {
      branch,
      collectionSlug: 'posts',
      operationId: 'op-2',
      parentId: post.id,
      previewToken: preview.previewToken,
      req,
      revision: preview.revision,
    }

    await applyMerge({ ...base, picks: { title: 'branch' } })

    await expect(applyMerge({ ...base, picks: { title: 'main' } })).rejects.toBeInstanceOf(
      OperationConflictError,
    )
  })
})

describe('branch creation', () => {
  it('captures a baseline when the source document has undefined optional fields', async () => {
    const collection = payload.collections['posts']?.config
    const undefineSettings = ({ doc }: { doc: Record<string, unknown> }) => {
      doc['settings'] = undefined

      return doc
    }

    collection?.hooks.afterRead.push(undefineSettings)

    try {
      const post = await payload.create({ collection: 'posts', data: { title: 'Main' }, req })
      const created = await createBranch({
        branchName: 'undefined-fields',
        collectionSlug: 'posts',
        createdBy: req.user?.id ?? '',
        parentId: post.id,
        payload,
        req,
      })

      expect(created.baselineManifest).toHaveProperty('settings')
      expect(created.baselineSnapshot).not.toHaveProperty('settings')
    } finally {
      const index = collection?.hooks.afterRead.indexOf(undefineSettings) ?? -1

      if (index >= 0) collection?.hooks.afterRead.splice(index, 1)
    }
  })

  it('classifies a duplicate create from the unique index without a pre-check', async () => {
    const post = await payload.create({ collection: 'posts', data: { title: 'Main' }, req })
    const attempt = () =>
      createBranch({
        branchName: 'same-name',
        collectionSlug: 'posts',
        createdBy: req.user?.id ?? '',
        parentId: post.id,
        payload,
        req,
      })

    await attempt()

    await expect(attempt()).rejects.toMatchObject({ code: 'BRANCH_EXISTS', status: 409 })
  })

  it('does not misclassify an unrelated validation failure as a duplicate', async () => {
    const post = await payload.create({ collection: 'posts', data: { title: 'Main' }, req })

    await expect(
      createBranch({
        branchName: 'x'.repeat(65),
        collectionSlug: 'posts',
        createdBy: req.user?.id ?? '',
        parentId: post.id,
        payload,
        req,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    await expect(
      createBranch({
        branchName: 'unrelated',
        collectionSlug: 'posts',
        createdBy: 'not-a-user-id',
        parentId: post.id,
        payload,
        req,
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
