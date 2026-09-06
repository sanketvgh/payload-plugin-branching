import type { CollectionBeforeOperationHook, CollectionSlug } from 'payload'

import { getActiveBranch } from '../utilities/getActiveBranch.js'
import { getBranchAncestry } from '../utilities/getBranchAncestry.js'
import { getCollectionIDType } from '../utilities/getCollectionIDType.js'
import { pickBestBranchMatch } from '../utilities/pickBestBranchMatch.js'

interface Args {
  branchesSlug: string
  branchFieldName: string
  canonicalIdFieldName: string
  collectionSlug: CollectionSlug
}

interface UpdateByIDArgs {
  data: Record<string, unknown>
  id: number | string
}

interface CurrentDoc {
  [key: string]: unknown
  createdAt?: unknown
  id: number | string
  updatedAt?: unknown
}

// One beforeOperation hook covering create/update/read, sharing a single
// idType + activeBranch resolution (`arg.req` is present unconditionally
// on every operation's args, per Payload's BeforeOperationArg type,
// unlike `arg.args`, which differs in shape per operation) instead of
// each operation recomputing it independently.
export const branchOperationHook =
  ({
    branchesSlug,
    branchFieldName,
    canonicalIdFieldName,
    collectionSlug,
  }: Args): CollectionBeforeOperationHook =>
  async (arg) => {
    const idType = getCollectionIDType({ collectionSlug: branchesSlug, payload: arg.req.payload })
    const activeBranch = getActiveBranch({ idType, req: arg.req })

    if (!activeBranch) {
      return arg.args
    }

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (arg.operation === 'create') {
      return { ...arg.args, data: { ...arg.args.data, [branchFieldName]: activeBranch } }
    }

    // Payload's bulk `update` operation also fires beforeOperation with
    // `operation: 'update'`, but its args are `{ where, data }` with no
    // singular `id`. Only updateByID's args carry an `id`, so that's the
    // actual discriminator here, not the operation literal alone. Payload's
    // own types tag updateByID's single-document args under a separate
    // 'updateByID' operation literal that never actually fires at runtime
    // (verified against Payload's updateByID operation source); the 'id'
    // in args check is the real runtime discriminator, and the assertion
    // below restores the `id`/typed `data` that are genuinely present but
    // that TS's narrowing (tied to the never-firing literal) can't see.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (arg.operation === 'update' && 'id' in arg.args) {
      const args = arg.args as typeof arg.args & UpdateByIDArgs

      const currentDoc = (await arg.req.payload.findByID({
        id: args.id,
        collection: collectionSlug,
        depth: 0,
        req: arg.req,
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

      // branch/canonicalId are internal plumbing, never user-editable:
      // strip them from the incoming write data so stale values from a
      // full-form submit (the admin edit form resubmits every field,
      // including hidden sidebar ones) can't stomp the divergence
      // bookkeeping below.
      const incomingData = Object.fromEntries(
        Object.entries(args.data).filter(
          ([key]) => key !== branchFieldName && key !== canonicalIdFieldName,
        ),
      )

      const existing = await arg.req.payload.find({
        collection: collectionSlug,
        limit: 1,
        req: arg.req,
        where: {
          and: [
            { [canonicalIdFieldName]: { equals: canonicalId } },
            { [branchFieldName]: { equals: activeBranch } },
          ],
        },
      })

      const [existingDoc] = existing.docs as { id: number | string }[]

      if (existingDoc) {
        return { ...args, id: existingDoc.id, data: incomingData }
      }

      const dataToCreate: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(currentDoc)) {
        if (
          ![branchFieldName, canonicalIdFieldName, 'createdAt', 'id', 'updatedAt'].includes(key)
        ) {
          dataToCreate[key] = value
        }
      }

      const newDoc = (await arg.req.payload.create({
        collection: collectionSlug,
        data: {
          ...dataToCreate,
          ...incomingData,
          [branchFieldName]: activeBranch,
          [canonicalIdFieldName]: canonicalId,
        },
        req: arg.req,
      })) as { id: number | string }

      return { ...args, id: newDoc.id, data: incomingData }
    }

    // Payload's legacy `operation: 'read'` union covers both `find` (list)
    // and `findByID` args; only findByID's args carry a singular `id`.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (arg.operation === 'read' && 'id' in arg.args) {
      const { args } = arg

      const ancestry = await getBranchAncestry({
        branchesSlug,
        branchId: activeBranch,
        payload: arg.req.payload,
        req: arg.req,
      })

      const ancestryIds = [activeBranch, ...ancestry]

      const result = await arg.req.payload.find({
        collection: collectionSlug,
        depth: 0,
        limit: 100,
        req: arg.req,
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

      const bestMatch = pickBestBranchMatch({ ancestryIds, branchFieldName, docs: result.docs })

      if (bestMatch && String(bestMatch.id) !== String(args.id)) {
        return { ...args, id: bestMatch.id }
      }

      return args
    }

    return arg.args
  }
