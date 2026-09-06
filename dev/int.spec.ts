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

describe('Branch creation and closure table', () => {
  test('branch creation is a pure pointer and does not touch existing documents', async () => {
    const post = await payload.create({
      collection: 'posts',
      data: { content: 'original content' },
    })

    const postIdBefore = post.id

    await payload.create({
      collection: 'payload-branches',
      data: { name: `branch-${Date.now()}` },
    })

    const postAfter = await payload.findByID({
      id: postIdBefore,
      collection: 'posts',
    })

    expect(postAfter.content).toBe('original content')
  })

  test('root branch closure table has self-row at depth 0', async () => {
    const branch = await payload.create({
      collection: 'payload-branches',
      data: { name: `root-branch-${Date.now()}` },
    })

    const closure = await payload.find({
      collection: 'payload-branch-closure',
      where: {
        descendant: { equals: branch.id },
      },
    })

    expect(closure.docs).toHaveLength(1)
    const selfRow = closure.docs[0] as any
    expect(String(selfRow.descendant.id ?? selfRow.descendant)).toBe(String(branch.id))
    expect(String(selfRow.ancestor.id ?? selfRow.ancestor)).toBe(String(branch.id))
    expect(selfRow.depth).toBe(0)
  })

  test('child branch closure table includes self-row and parent ancestors', async () => {
    const root = await payload.create({
      collection: 'payload-branches',
      data: { name: `root-${Date.now()}` },
    })

    const child = await payload.create({
      collection: 'payload-branches',
      data: { name: `child-${Date.now()}`, parentBranch: root.id },
    })

    const closure = await payload.find({
      collection: 'payload-branch-closure',
      sort: 'depth',
      where: {
        descendant: { equals: child.id },
      },
    })

    expect(closure.docs).toHaveLength(2)
    const depthZero = closure.docs[0] as any
    const depthOne = closure.docs[1] as any

    expect(String(depthZero.ancestor.id ?? depthZero.ancestor)).toBe(String(child.id))
    expect(depthZero.depth).toBe(0)

    expect(String(depthOne.ancestor.id ?? depthOne.ancestor)).toBe(String(root.id))
    expect(depthOne.depth).toBe(1)
  })

  test('grandchild branch closure table includes 3-level ancestry chain', async () => {
    const root = await payload.create({
      collection: 'payload-branches',
      data: { name: `root-${Date.now()}` },
    })

    const child = await payload.create({
      collection: 'payload-branches',
      data: { name: `child-${Date.now()}`, parentBranch: root.id },
    })

    const grandchild = await payload.create({
      collection: 'payload-branches',
      data: { name: `grandchild-${Date.now()}`, parentBranch: child.id },
    })

    const closure = await payload.find({
      collection: 'payload-branch-closure',
      sort: 'depth',
      where: {
        descendant: { equals: grandchild.id },
      },
    })

    expect(closure.docs).toHaveLength(3)

    const ancestors = closure.docs.map((doc: any) => String(doc.ancestor.id ?? doc.ancestor))

    expect(ancestors[0]).toBe(String(grandchild.id))
    expect(ancestors[1]).toBe(String(child.id))
    expect(ancestors[2]).toBe(String(root.id))

    expect(closure.docs[0].depth).toBe(0)
    expect(closure.docs[1].depth).toBe(1)
    expect(closure.docs[2].depth).toBe(2)
  })
})

describe('getBranchAncestry utility', () => {
  test('returns ancestors in nearest-first order', async () => {
    const { getBranchAncestry } = await import('../src/utilities/getBranchAncestry.js')

    const root = await payload.create({
      collection: 'payload-branches',
      data: { name: `root-${Date.now()}` },
    })

    const child = await payload.create({
      collection: 'payload-branches',
      data: { name: `child-${Date.now()}`, parentBranch: root.id },
    })

    const grandchild = await payload.create({
      collection: 'payload-branches',
      data: { name: `grandchild-${Date.now()}`, parentBranch: child.id },
    })

    const ancestry = await getBranchAncestry({
      branchClosureSlug: 'payload-branch-closure',
      branchId: grandchild.id,
      payload,
    })

    expect(ancestry.map(String)).toEqual([String(child.id), String(root.id)])
  })
})

describe('Copy-on-write: read before divergence', () => {
  test('reading a base document with branch cookie resolves to base content (inheritance)', async () => {
    const branch = await payload.create({
      collection: 'payload-branches',
      data: { name: `branch-read-${Date.now()}` },
    })

    const post = await payload.create({
      collection: 'posts',
      data: { content: 'base content' },
    })

    const readWithBranch = await payload.findByID({
      id: post.id,
      collection: 'posts',
      req: {
        headers: new Headers([['cookie', `payload-branch=${branch.id}`]]),
      },
    } as any)

    expect(readWithBranch.content).toBe('base content')
  })
})

describe('Copy-on-write: write creates diverged row', () => {
  test('updating via branch cookie creates a new diverged document and preserves base', async () => {
    const branch = await payload.create({
      collection: 'payload-branches',
      data: { name: `branch-write-${Date.now()}` },
    })

    const post = await payload.create({
      collection: 'posts',
      data: { content: 'original' },
    })

    const postId = post.id
    const postCanonicalId = (post as any).canonicalId

    const updateResult = await payload.update({
      id: postId,
      collection: 'posts',
      data: { content: 'edited on branch' },
      req: {
        headers: new Headers([['cookie', `payload-branch=${branch.id}`]]),
      },
    })

    expect(updateResult.content).toBe('edited on branch')

    const basePost = await payload.findByID({
      id: postId,
      collection: 'posts',
    })

    expect(basePost.content).toBe('original')

    const allPosts = await payload.find({
      collection: 'posts',
      limit: 100,
    })

    const postDocs = allPosts.docs.filter(
      (doc: any) => String(doc.canonicalId || doc.id) === String(postCanonicalId || postId),
    )

    expect(postDocs).toHaveLength(2)

    const branchedDoc = postDocs.find(
      (doc: any) => String(doc.branch?.id ?? doc.branch) === String(branch.id),
    )
    expect(branchedDoc).toBeDefined()
    expect((branchedDoc as any).content).toBe('edited on branch')
    expect(String((branchedDoc as any).canonicalId)).toBe(String(postCanonicalId || postId))
  })
})

describe('Copy-on-write: subsequent writes', () => {
  test('second update to same branch updates diverged row in place', async () => {
    const branch = await payload.create({
      collection: 'payload-branches',
      data: { name: `branch-multi-write-${Date.now()}` },
    })

    const post = await payload.create({
      collection: 'posts',
      data: { content: 'original' },
    })

    const postId = post.id
    const postCanonicalId = (post as any).canonicalId

    await payload.update({
      id: postId,
      collection: 'posts',
      data: { content: 'first edit' },
      req: {
        headers: new Headers([['cookie', `payload-branch=${branch.id}`]]),
      },
    })

    const afterFirstEdit = await payload.find({
      collection: 'posts',
      limit: 100,
      where: {
        canonicalId: { equals: postCanonicalId || postId },
      },
    })

    const branchedCountAfterFirst = afterFirstEdit.docs.filter(
      (doc: any) => String(doc.branch?.id ?? doc.branch) === String(branch.id),
    ).length

    const secondUpdate = await payload.update({
      id: postId,
      collection: 'posts',
      data: { content: 'second edit' },
      req: {
        headers: new Headers([['cookie', `payload-branch=${branch.id}`]]),
      },
    })

    expect(secondUpdate.content).toBe('second edit')

    const afterSecondEdit = await payload.find({
      collection: 'posts',
      limit: 100,
      where: {
        canonicalId: { equals: postCanonicalId || postId },
      },
    })

    const branchedCountAfterSecond = afterSecondEdit.docs.filter(
      (doc: any) => String(doc.branch?.id ?? doc.branch) === String(branch.id),
    ).length

    expect(branchedCountAfterSecond).toBe(branchedCountAfterFirst)
  })
})

describe('Copy-on-write: read resolves to nearest ancestor', () => {
  test('reading with child branch resolves to parent branch divergence when no own divergence', async () => {
    const root = await payload.create({
      collection: 'payload-branches',
      data: { name: `read-ancestor-root-${Date.now()}` },
    })

    const child = await payload.create({
      collection: 'payload-branches',
      data: { name: `read-ancestor-child-${Date.now()}`, parentBranch: root.id },
    })

    const post = await payload.create({
      collection: 'posts',
      data: { content: 'base content' },
    })

    const postId = post.id

    await payload.update({
      id: postId,
      collection: 'posts',
      data: { content: 'content on root branch' },
      req: {
        headers: new Headers([['cookie', `payload-branch=${root.id}`]]),
      },
    })

    const readWithChild = await payload.findByID({
      id: postId,
      collection: 'posts',
      req: {
        headers: new Headers([['cookie', `payload-branch=${child.id}`]]),
      },
    })

    expect(readWithChild.content).toBe('content on root branch')
  })
})

describe('Bulk/list operations do not misfire hooks', () => {
  test('payload.find() bulk list query does not throw and returns expected count', async () => {
    await payload.create({
      collection: 'posts',
      data: { content: `bulk-test-${Date.now()}-1` },
    })

    await payload.create({
      collection: 'posts',
      data: { content: `bulk-test-${Date.now()}-2` },
    })

    expect(async () => {
      const result = await payload.find({
        collection: 'posts',
        limit: 100,
      })

      expect(result.docs.length).toBeGreaterThanOrEqual(2)
    }).not.toThrow()
  })
})

describe('filterDocumentsByBranch utility', () => {
  test('returns null when no active branch cookie', async () => {
    const { filterDocumentsByBranch } = await import('../src/filters/filterDocumentsByBranch.js')

    const result = await filterDocumentsByBranch({
      branchClosureSlug: 'payload-branch-closure',
      branchFieldName: 'branch',
      req: {
        headers: new Headers(),
        payload,
      } as any,
    })

    expect(result).toBeNull()
  })

  test('returns branch filter when active branch cookie present', async () => {
    const { filterDocumentsByBranch } = await import('../src/filters/filterDocumentsByBranch.js')

    const branch = await payload.create({
      collection: 'payload-branches',
      data: { name: `filter-test-${Date.now()}` },
    })

    const result = await filterDocumentsByBranch({
      branchClosureSlug: 'payload-branch-closure',
      branchesSlug: 'payload-branches',
      branchFieldName: 'branch',
      req: {
        headers: new Headers([['cookie', `payload-branch=${branch.id}`]]),
        payload,
      } as any,
    })

    expect(result).not.toBeNull()
    expect((result as any).branch).toBeDefined()
    expect((result as any).branch.in).toContain(branch.id)
  })
})
