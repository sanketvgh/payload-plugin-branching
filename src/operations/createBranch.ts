import type { CollectionSlug, Field, Payload, PayloadRequest } from 'payload'
import { z } from 'zod'

import { branchableFields } from '../branches/fields.js'
import { normalizeOptionalBranchValue } from '../branches/values.js'
import { branchesSlug } from '../collections/createBranchesCollection.js'
import { documentDataSchema } from '../contracts/common.js'
import { storedBranchSchema, type StoredBranch } from '../contracts/storedBranch.js'
import { BranchingAPIError } from '../errors.js'
import { branchRequest } from '../utilities/branchAccess.js'
import { fieldPermitted } from '../utilities/branchDocument.js'

export interface CreateBranchArgs {
  branchName: string
  collectionSlug: CollectionSlug
  copyFrom?: string
  createdBy?: number | string
  parentId: number | string
  payload: Payload
  req: PayloadRequest
}

const captureSnapshot = async ({
  fields,
  parentId,
  req,
  source,
}: {
  fields: Field[]
  parentId: number | string
  req: PayloadRequest
  source: Record<string, unknown>
}): Promise<{
  manifest: Record<string, { captured: true }>
  snapshot: Record<string, unknown>
}> => {
  const snapshot: Record<string, unknown> = {}
  const manifest: Record<string, { captured: true }> = {}

  for (const field of branchableFields(fields)) {
    const fieldName = 'name' in field && typeof field.name === 'string' ? field.name : ''

    if (fieldName === '') continue

    if (await fieldPermitted(field, 'read', req, parentId)) {
      manifest[fieldName] = { captured: true }

      const value = normalizeOptionalBranchValue(source[fieldName])

      if (value !== undefined) snapshot[fieldName] = value
    }
  }

  return { manifest, snapshot }
}

const validateCreateBranchArgs = ({
  branchName,
  copyFrom,
  req,
}: Pick<CreateBranchArgs, 'branchName' | 'copyFrom' | 'req'>): void => {
  if (!req.user) throw new BranchingAPIError('Unauthorized', 401, 'UNAUTHORIZED')

  if (branchName.trim() === '' || branchName.length > 64) {
    throw new BranchingAPIError(
      'branchName must be a non-empty string up to 64 characters',
      400,
      'INVALID_REQUEST',
    )
  }

  if (copyFrom !== 'main' && copyFrom !== 'published') {
    throw new BranchingAPIError(
      'copyFrom must be "main" or "published"; branch-to-branch copy is unsupported',
      400,
      'INVALID_REQUEST',
    )
  }
}

const readSavedSource = async (args: CreateBranchArgs): Promise<Record<string, unknown>> => {
  const { collectionSlug, copyFrom, parentId, payload, req } = args

  const source = documentDataSchema.parse(
    await payload.findByID({
      id: parentId,
      collection: collectionSlug,
      draft: copyFrom !== 'published',
      overrideAccess: false,
      req,
    }),
  )

  if (copyFrom === 'published' && source['_status'] !== 'published')
    throw new BranchingAPIError(
      'No published main content exists for this document',
      404,
      'SOURCE_NOT_FOUND',
    )

  return source
}

const branchExists = async ({
  branchName,
  collectionSlug,
  parentId,
  req,
}: Pick<
  CreateBranchArgs,
  'branchName' | 'collectionSlug' | 'parentId' | 'req'
>): Promise<boolean> => {
  try {
    const found = await req.payload.find({
      collection: branchesSlug(collectionSlug),
      limit: 1,
      overrideAccess: false,
      req: await branchRequest(req),
      where: { and: [{ parent: { equals: parentId } }, { branch: { equals: branchName } }] },
    })

    return found.docs.length > 0
  } catch {
    return false
  }
}

export const createBranch = async (args: CreateBranchArgs): Promise<StoredBranch> => {
  const { branchName, collectionSlug, copyFrom = 'main', createdBy, parentId, payload, req } = args

  validateCreateBranchArgs({ branchName, copyFrom, req })
  const collection = payload.collections[collectionSlug]?.config

  if (!collection)
    throw new BranchingAPIError(`Unknown collection "${collectionSlug}"`, 400, 'INVALID_COLLECTION')
  const source = await readSavedSource(args)

  const { manifest, snapshot } = await captureSnapshot({
    fields: collection.fields,
    parentId,
    req,
    source,
  })

  const custom = z
    .looseObject({ branchSnapshotMaxBytes: z.number().optional() })
    .safeParse(collection.custom)

  const max = custom.success ? (custom.data.branchSnapshotMaxBytes ?? 1024 * 1024) : 1024 * 1024

  const bytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8')

  if (!Number.isSafeInteger(max) || max < 1 || bytes > max)
    throw new BranchingAPIError(
      `Branch baseline exceeds the configured ${String(max)}-byte snapshot limit`,
      422,
      'SNAPSHOT_TOO_LARGE',
    )
  const branchReq = await branchRequest(req)

  try {
    const created = await payload.create({
      collection: branchesSlug(collectionSlug),
      data: {
        baselineCapturedAt: new Date().toISOString(),
        baselineManifest: manifest,
        baselineRevision: typeof source['updatedAt'] === 'string' ? source['updatedAt'] : '',
        baselineSnapshot: snapshot,
        branch: branchName,
        createdBy,
        diverged: false,
        overrides: {},
        parent: parentId,
        revision: 0,
      },
      overrideAccess: false,
      req: branchReq,
    })

    return storedBranchSchema.parse(created)
  } catch (error) {
    if (await branchExists({ branchName, collectionSlug, parentId, req })) {
      throw new BranchingAPIError(
        `Branch "${branchName}" already exists for this document`,
        409,
        'BRANCH_EXISTS',
      )
    }

    throw error
  }
}
