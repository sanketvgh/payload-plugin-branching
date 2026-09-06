import type { CollectionSlug, PayloadRequest } from 'payload'

import { getBranchFromCookie } from '../utilities/getBranchFromCookie.js'
import { getCollectionIDType } from '../utilities/getCollectionIDType.js'

interface Args {
  branchesSlug: string
  branchFieldName: string
  canonicalIdFieldName: string
  collectionSlug: CollectionSlug
}

interface UpdateByIDArgs {
  collection: { config: { slug: CollectionSlug } }
  data?: Record<string, unknown>
  id: number | string
  req: PayloadRequest
}

interface HookArg {
  args: UpdateByIDArgs
  operation: string
}

interface CurrentDoc {
  [key: string]: unknown
  createdAt?: unknown
  id: number | string
  updatedAt?: unknown
}

// Payload's `beforeOperation` runs with `operation: 'update'` for
// updateByID's single-document args (id/data), even though the public
// BeforeOperationHook type still ties 'update' to the bulk-update args
// shape (where/data) for backward compatibility. Typed against the
// actual runtime shape here; wired up with a cast in src/index.ts.
export const redirectUpdateToBranch =
  ({ branchesSlug, branchFieldName, canonicalIdFieldName, collectionSlug }: Args) =>
  async (arg: HookArg): Promise<UpdateByIDArgs> => {
    const { args, operation } = arg

    // Payload's bulk `update` operation also fires beforeOperation with
    // `operation: 'update'`, but its args are `{ where, data }` with no
    // singular `id`. Only updateByID's args carry an `id`, so that's the
    // actual discriminator between the two here.
    if (operation !== 'update' || !('id' in args)) {
      return args
    }

    const idType = getCollectionIDType({ collectionSlug: branchesSlug, payload: args.req.payload })
    const activeBranch = getBranchFromCookie(args.req.headers, idType)

    if (!activeBranch) {
      return args
    }

    const currentDoc = (await args.req.payload.findByID({
      id: args.id,
      collection: collectionSlug,
      depth: 0,
      req: args.req,
    })) as CurrentDoc

    const ownBranch = currentDoc[branchFieldName]
    const ownBranchId =
      ownBranch && typeof ownBranch === 'object' && 'id' in ownBranch
        ? (ownBranch as { id: number | string }).id
        : (ownBranch as null | number | string)

    if (String(ownBranchId) === String(activeBranch)) {
      return args
    }

    const existingCanonicalId = currentDoc[canonicalIdFieldName] as null | string | undefined
    const canonicalId = existingCanonicalId ?? String(currentDoc.id)

    const existing = await args.req.payload.find({
      collection: collectionSlug,
      limit: 1,
      req: args.req,
      where: {
        and: [
          { [canonicalIdFieldName]: { equals: canonicalId } },
          { [branchFieldName]: { equals: activeBranch } },
        ],
      },
    })

    const [existingDoc] = existing.docs as { id: number | string }[]

    if (existingDoc) {
      return { ...args, id: existingDoc.id }
    }

    const dataToCreate: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(currentDoc)) {
      if (![branchFieldName, canonicalIdFieldName, 'createdAt', 'id', 'updatedAt'].includes(key)) {
        dataToCreate[key] = value
      }
    }

    const newDoc = (await args.req.payload.create({
      collection: collectionSlug,
      data: {
        ...dataToCreate,
        ...(args.data ?? {}),
        [branchFieldName]: activeBranch,
        [canonicalIdFieldName]: canonicalId,
      },
      req: args.req,
    })) as { id: number | string }

    return { ...args, id: newDoc.id }
  }
