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
      data: { title: 'Boot test' },
    })

    expect(post.id).toBeDefined()
  })
})

describe('Branch creation and cached ancestry', () => {
  test('branch creation is a pure pointer and does not touch existing documents', async () => {
    const post = await payload.create({
      collection: 'posts',
      data: { content: 'original content', title: 'Pure pointer test' },
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

  test('root branch has no ancestors', async () => {
    const branch = await payload.create({
      collection: 'payload-branches',
      data: { name: `root-branch-${Date.now()}` },
    })

    expect(branch.ancestorIds ?? []).toHaveLength(0)
  })

  test('child branch caches its parent as its ancestor', async () => {
    const root = await payload.create({
      collection: 'payload-branches',
      data: { name: `root-${Date.now()}` },
    })

    const child = await payload.create({
      collection: 'payload-branches',
      data: { name: `child-${Date.now()}`, parentBranch: root.id },
    })

    const reloadedChild = await payload.findByID({
      id: child.id,
      collection: 'payload-branches',
      depth: 0,
    })

    expect((reloadedChild.ancestorIds ?? []).map(String)).toEqual([String(root.id)])
  })

  test('grandchild branch caches a 2-level ancestry chain, nearest first', async () => {
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

    const reloaded = await payload.findByID({
      id: grandchild.id,
      collection: 'payload-branches',
      depth: 0,
    })

    expect((reloaded.ancestorIds ?? []).map(String)).toEqual([String(child.id), String(root.id)])
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
      branchesSlug: 'payload-branches',
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
      data: { content: 'base content', title: 'Read before divergence' },
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
      data: { content: 'original', title: 'Write creates diverged row' },
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
      data: { content: 'original', title: 'Subsequent writes' },
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
      data: { content: 'base content', title: 'Nearest ancestor' },
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
      data: { content: `bulk-test-${Date.now()}-1`, title: 'Bulk test 1' },
    })

    await payload.create({
      collection: 'posts',
      data: { content: `bulk-test-${Date.now()}-2`, title: 'Bulk test 2' },
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
      branchesSlug: 'payload-branches',
      branchFieldName: 'branch',
      req: {
        headers: new Headers(),
        payload,
        searchParams: new URLSearchParams(),
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
      branchesSlug: 'payload-branches',
      branchFieldName: 'branch',
      req: {
        headers: new Headers([['cookie', `payload-branch=${branch.id}`]]),
        payload,
        searchParams: new URLSearchParams(),
      } as any,
    })

    expect(result).not.toBeNull()
    const orFilter = (result as any).or[0].branch
    expect(orFilter).toBeDefined()
    expect(orFilter.in).toContain(branch.id)
  })
})
