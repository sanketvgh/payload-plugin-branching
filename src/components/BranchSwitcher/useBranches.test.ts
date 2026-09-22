import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchAllBranches } from './branchPagination.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchAllBranches', () => {
  it('follows pagination beyond the first 100 branches', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      branch: `branch-${index + 1}`,
      diverged: false,
      revision: 0,
    }))

    const request = vi.fn((input: RequestInfo | URL) => {
      const requestURL = input instanceof Request ? input.url : input.toString()
      const page = new URL(requestURL).searchParams.get('page')

      return Promise.resolve(
        Response.json(
          page === '1'
            ? { docs: firstPage, hasNextPage: true, nextPage: 2 }
            : {
                docs: [{ id: 101, branch: 'branch-101', diverged: true, revision: 3 }],
                hasNextPage: false,
                nextPage: null,
              },
        ),
      )
    })

    vi.stubGlobal('fetch', request)

    const branches = await fetchAllBranches(
      'https://example.test/api/payload-plugin-branching/branches/list',
      'posts',
      42,
      new AbortController().signal,
    )

    expect(request).toHaveBeenCalledTimes(2)
    expect(branches).toHaveLength(101)
    expect(branches[100]).toEqual({ id: 101, branch: 'branch-101', diverged: true, revision: 3 })
  })
})
