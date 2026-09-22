import { z } from 'zod'

import { branchSummarySchema } from '../../contracts/branches.js'

const branchPageSchema = z.object({
  docs: z.array(branchSummarySchema),
  hasNextPage: z.boolean(),
  nextPage: z.number().int().positive().nullable(),
})

export interface BranchRow {
  branch: string
  diverged: boolean
  id: number | string
  revision: number
}

interface FetchBranchPageArgs {
  baseURL: string
  collectionSlug: string
  page: number
  parentId: number | string
  signal: AbortSignal
}

const fetchBranchPage = async ({
  baseURL,
  collectionSlug,
  page,
  parentId,
  signal,
}: FetchBranchPageArgs): Promise<z.infer<typeof branchPageSchema>> => {
  const url = URL.canParse(baseURL) ? new URL(baseURL) : new URL(baseURL, document.baseURI)

  url.searchParams.set('collectionSlug', collectionSlug)
  url.searchParams.set('limit', '100')
  url.searchParams.set('page', String(page))
  url.searchParams.set('parentId', String(parentId))

  const response = await fetch(url, { credentials: 'include', signal })

  if (!response.ok) throw new Error('Could not list branches')

  return branchPageSchema.parse(await response.json())
}

export const fetchAllBranches = async (
  baseURL: string,
  collectionSlug: string,
  parentId: number | string,
  signal: AbortSignal,
): Promise<BranchRow[]> => {
  const branches: BranchRow[] = []
  let page = 1

  while (true) {
    const result = await fetchBranchPage({ baseURL, collectionSlug, page, parentId, signal })

    branches.push(...result.docs)

    if (!result.hasNextPage || result.nextPage == null) return branches
    page = result.nextPage
  }
}
