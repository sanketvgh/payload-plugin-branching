import type { Payload, PayloadRequest } from 'payload'

interface Args {
  branchClosureSlug: string
  branchId: number | string
  payload: Payload
  req?: PayloadRequest
}

export async function getBranchAncestry({
  branchClosureSlug,
  branchId,
  payload,
  req,
}: Args): Promise<(number | string)[]> {
  const result = await payload.find({
    collection: branchClosureSlug,
    depth: 0,
    limit: 0,
    sort: 'depth',
    where: {
      descendant: { equals: branchId },
    },
    ...(req ? { req } : {}),
  })

  return result.docs
    .filter((doc) => (doc as unknown as { depth: number }).depth !== 0)
    .map((doc) => (doc as unknown as { ancestor: number | string }).ancestor)
}
