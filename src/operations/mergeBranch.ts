import { createHash } from 'node:crypto'

import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

import { branchesSlug } from '../collections/createBranchesCollection.js'
import { documentDataSchema } from '../contracts/common.js'
import { storedBranchSchema, type StoredBranch } from '../contracts/storedBranch.js'
import { BranchingAPIError } from '../errors.js'
import { threeWayMerge, type ThreeWayMergeResult } from '../merge/threeWayMerge.js'
import { branchRequest } from '../utilities/branchAccess.js'
import { clone, fieldPermitted, topLevelFields } from '../utilities/branchDocument.js'

import type { MergePreview } from './mergeTypes.js'

export interface MergeBranchArgs {
  branch: string
  collectionSlug: CollectionSlug
  parentId: number | string
  payload: Payload
  req: PayloadRequest
}
export type MergeBranchResult = {
  base: MergePreview['base']
  baselineDoc: Record<string, unknown>
  branch: MergePreview['branch']
  branchDoc: Record<string, unknown>
  branchRow: StoredBranch
  mainDoc: Record<string, unknown>
  preview: MergePreview
  previewToken: string
  revision: MergePreview['revision']
  target: MergePreview['target']
} & ThreeWayMergeResult<Record<string, unknown>>

const requireCollection = (payload: Payload, collectionSlug: CollectionSlug) => {
  const collection = payload.collections[collectionSlug]?.config

  if (!collection)
    throw new BranchingAPIError(`Unknown collection "${collectionSlug}"`, 400, 'INVALID_COLLECTION')

  return collection
}

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('base64url')

const buildMergeDocuments = async ({
  collection,
  main,
  manifest,
  overrides,
  parentId,
  req,
  snapshot,
}: {
  collection: NonNullable<PayloadRequest['payload']['collections'][string]>['config']
  main: Record<string, unknown>
  manifest: Record<string, unknown>
  overrides: Record<string, unknown>
  parentId: number | string
  req: PayloadRequest
  snapshot: Record<string, unknown>
}): Promise<{
  base: Record<string, unknown>
  theirs: Record<string, unknown>
  yours: Record<string, unknown>
}> => {
  const base: Record<string, unknown> = {}
  const theirs: Record<string, unknown> = {}
  const yours: Record<string, unknown> = {}
  const metadata = new Set(['_status', 'createdAt', 'id', 'updatedAt'])

  for (const field of topLevelFields(collection.fields)) {
    const fieldName = 'name' in field && typeof field.name === 'string' ? field.name : ''

    if (fieldName === '' || metadata.has(fieldName)) continue
    if (!(await fieldPermitted(field, 'read', req, parentId))) continue

    if (!Object.hasOwn(manifest, fieldName)) {
      throw new BranchingAPIError(
        `Field "${fieldName}" was not captured in this branch baseline; recreate the branch before merging`,
        409,
        'MISSING_BASELINE',
      )
    }

    base[fieldName] = clone(snapshot[fieldName])
    theirs[fieldName] = clone(main[fieldName])

    yours[fieldName] = Object.hasOwn(overrides, fieldName)
      ? clone(overrides[fieldName])
      : clone(snapshot[fieldName])
  }

  return { base, theirs, yours }
}

const createPreview = ({
  branch,
  branchRow,
  collectionSlug,
  parentId,
  result,
  revision,
  targetUpdatedAt,
}: {
  branch: string
  branchRow: StoredBranch
  collectionSlug: CollectionSlug
  parentId: number | string
  result: ThreeWayMergeResult<Record<string, unknown>>
  revision: MergePreview['revision']
  targetUpdatedAt: string | undefined
}): MergePreview => {
  const previewToken = digest({
    baseline: branchRow.baselineRevision,
    branch: branchRow.id,
    collectionSlug,
    parentId,
    revision,
  })

  return {
    automatic: result.automatic,
    base: {
      capturedAt: branchRow.baselineCapturedAt,
      revision: branchRow.baselineRevision,
      source: 'snapshot',
    },
    branch: {
      id: branchRow.id,
      name: branch,
      updatedAt: branchRow.updatedAt,
    },
    collectionSlug,
    conflicts: result.contested,
    contractVersion: 1,
    previewToken,
    revision,
    target: { id: parentId, revision: revision.targetRevision, updatedAt: targetUpdatedAt },
  }
}

export const mergeBranch = async ({
  branch,
  collectionSlug,
  parentId,
  payload,
  req,
}: MergeBranchArgs): Promise<MergeBranchResult> => {
  if (!req.user) throw new BranchingAPIError('Unauthorized', 401, 'UNAUTHORIZED')
  const collection = requireCollection(payload, collectionSlug)

  const main = documentDataSchema.parse(
    await payload.findByID({
      id: parentId,
      collection: collectionSlug,
      overrideAccess: false,
      req,
    }),
  )

  const found = await payload.find({
    collection: branchesSlug(collectionSlug),
    limit: 1,
    overrideAccess: false,
    req: await branchRequest(req),
    where: { and: [{ parent: { equals: parentId } }, { branch: { equals: branch } }] },
  })

  const branchDocument = found.docs[0]

  if (!branchDocument)
    throw new BranchingAPIError(
      `Branch "${branch}" does not exist for this document`,
      404,
      'BRANCH_NOT_FOUND',
    )
  const parsedBranch = storedBranchSchema.safeParse(branchDocument)

  if (!parsedBranch.success)
    throw new BranchingAPIError(
      'Branch baseline is missing or unreadable; recreate or repair this branch before merging',
      409,
      'MISSING_BASELINE',
    )
  const branchRow = parsedBranch.data
  const { baselineManifest: manifest, baselineSnapshot: snapshot, overrides } = branchRow

  const { base, theirs, yours } = await buildMergeDocuments({
    collection,
    main,
    manifest,
    overrides,
    parentId,
    req,
    snapshot,
  })

  const result = threeWayMerge(base, theirs, yours)

  const revision = {
    branchRevision: digest({ manifest, overrides, revision: branchRow.revision, snapshot }),
    branchUpdatedAt: branchRow.updatedAt,
    targetRevision: digest(theirs),
    targetUpdatedAt: typeof main['updatedAt'] === 'string' ? main['updatedAt'] : undefined,
  }

  const preview = createPreview({
    branch,
    branchRow,
    collectionSlug,
    parentId,
    result,
    revision,
    targetUpdatedAt: typeof main['updatedAt'] === 'string' ? main['updatedAt'] : undefined,
  })

  const { previewToken } = preview

  return {
    ...result,
    base: preview.base,
    baselineDoc: base,
    branch: preview.branch,
    branchDoc: yours,
    branchRow,
    mainDoc: theirs,
    preview,
    previewToken,
    revision,
    target: preview.target,
  }
}
