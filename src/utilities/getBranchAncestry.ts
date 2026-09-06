import type { Payload, PayloadRequest } from 'payload'

interface Args {
  branchesSlug: string
  branchId: number | string
  payload: Payload
  req?: PayloadRequest
}

interface BranchDoc {
  ancestorIds?: (number | string)[] | null
}

// Ancestry is precomputed once, at branch-creation time (see
// branches.ts's afterChange hook), and cached as `ancestorIds` on the
// branch itself, nearest-first. This is a plain field read, not a query
// against a separate collection.
export async function getBranchAncestry({
  branchesSlug,
  branchId,
  payload,
  req,
}: Args): Promise<(number | string)[]> {
  const branch = (await payload.findByID({
    id: branchId,
    collection: branchesSlug,
    depth: 0,
    ...(req ? { req } : {}),
  })) as BranchDoc

  return branch.ancestorIds ?? []
}
