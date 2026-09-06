import type { CollectionSlug, PayloadRequest } from 'payload'

import { getBranchAncestry } from '../utilities/getBranchAncestry.js'
import { getBranchFromCookie } from '../utilities/getBranchFromCookie.js'
import { getCollectionIDType } from '../utilities/getCollectionIDType.js'

interface Args {
  branchClosureSlug: string
  branchesSlug: string
  branchFieldName: string
  canonicalIdFieldName: string
  collectionSlug: CollectionSlug
}

interface FindByIDArgs {
  collection: { config: { slug: CollectionSlug } }
  id: number | string
  req: PayloadRequest
}

interface HookArg {
  args: FindByIDArgs
  operation: string
}

interface BranchedDoc {
  [key: string]: unknown
  id: number | string
}

export const redirectReadToBranch =
  ({
    branchClosureSlug,
    branchesSlug,
    branchFieldName,
    canonicalIdFieldName,
    collectionSlug,
  }: Args) =>
  async (arg: HookArg): Promise<FindByIDArgs> => {
    const { args, operation } = arg

    // Payload's `find` (list) operation also fires beforeOperation with
    // `operation: 'read'` for legacy back-compat, but its args have no
    // `id` field. Only findByID's args carry a singular `id`, so that's
    // the actual discriminator between the two here.
    if (operation !== 'read' || !('id' in args)) {
      return args
    }

    const idType = getCollectionIDType({ collectionSlug: branchesSlug, payload: args.req.payload })
    const activeBranch = getBranchFromCookie(args.req.headers, idType)

    if (!activeBranch) {
      return args
    }

    const ancestry = await getBranchAncestry({
      branchClosureSlug,
      branchId: activeBranch,
      payload: args.req.payload,
      req: args.req,
    })

    const ancestryIds = [activeBranch, ...ancestry]

    const result = await args.req.payload.find({
      collection: collectionSlug,
      depth: 0,
      limit: 100,
      req: args.req,
      where: {
        and: [
          {
            or: [
              { id: { equals: args.id } },
              { [canonicalIdFieldName]: { equals: String(args.id) } },
            ],
          },
          { [branchFieldName]: { in: ancestryIds } },
        ],
      },
    })

    let bestMatch: BranchedDoc | null = null
    let bestRank = Infinity

    for (const doc of result.docs as BranchedDoc[]) {
      const branchValue = doc[branchFieldName]
      const branchId =
        branchValue && typeof branchValue === 'object' && 'id' in branchValue
          ? (branchValue as { id: number | string }).id
          : (branchValue as null | number | string)

      const rank = ancestryIds.findIndex((id) => String(id) === String(branchId))

      if (rank !== -1 && rank < bestRank) {
        bestRank = rank
        bestMatch = doc
      }
    }

    if (bestMatch && String(bestMatch.id) !== String(args.id)) {
      return { ...args, id: bestMatch.id }
    }

    return args
  }
