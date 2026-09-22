import type { CollectionSlug, Payload, PayloadRequest } from 'payload'
import { hasDraftsEnabled } from 'payload/shared'

import { branchesSlug } from '../collections/createBranchesCollection.js'
import { documentDataSchema } from '../contracts/common.js'
import { storedBranchSchema, type StoredBranch } from '../contracts/storedBranch.js'
import { BranchingAPIError } from '../errors.js'
import { branchRequest } from '../utilities/branchAccess.js'
import { clone } from '../utilities/branchDocument.js'

export interface ResolveBranchArgs {
  branch: string
  collectionSlug: CollectionSlug
  parentId: number | string
  payload: Payload
  req: PayloadRequest
}
export interface ResolveBranchResult {
  branchDoc: StoredBranch
  overrides: Record<string, unknown>
  parentMetadata: Record<string, unknown>
  resolvedDoc: Record<string, unknown>
}

const metadataFields = ['_status', 'createdAt', 'id', 'updatedAt']

const pickMetadata = (doc: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(metadataFields.filter((key) => key in doc).map((key) => [key, doc[key]]))

export const resolveBranch = async ({
  branch,
  collectionSlug,
  parentId,
  payload,
  req,
}: ResolveBranchArgs): Promise<ResolveBranchResult> => {
  if (!req.user) throw new BranchingAPIError('Unauthorized', 401, 'UNAUTHORIZED')
  const collection = payload.collections[collectionSlug]?.config

  const parentDoc = documentDataSchema.parse(
    await payload.findByID({
      id: parentId,
      collection: collectionSlug,
      draft: collection ? hasDraftsEnabled(collection) : false,
      overrideAccess: false,
      req,
    }),
  )

  const result = await payload.find({
    collection: branchesSlug(collectionSlug),
    limit: 1,
    overrideAccess: false,
    req: await branchRequest(req),
    where: { and: [{ parent: { equals: parentId } }, { branch: { equals: branch } }] },
  })

  const branchDoc = result.docs[0]

  if (!branchDoc)
    throw new BranchingAPIError(
      `Branch "${branch}" does not exist for this document`,
      404,
      'BRANCH_NOT_FOUND',
    )
  const parsedBranch = storedBranchSchema.safeParse(branchDoc)

  if (!parsedBranch.success)
    throw new BranchingAPIError(
      'Branch baseline is missing or unreadable; recreate or repair this branch before continuing',
      409,
      'MISSING_BASELINE',
    )
  const overrides = clone(parsedBranch.data.overrides)

  return {
    branchDoc: parsedBranch.data,
    overrides,
    parentMetadata: pickMetadata(parentDoc),
    resolvedDoc: {
      ...clone(parsedBranch.data.baselineSnapshot),
      ...overrides,
    },
  }
}
