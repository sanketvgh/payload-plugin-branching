import { createHash } from 'node:crypto'

import type { CollectionSlug, PayloadRequest, SanitizedCollectionConfig } from 'payload'

import { normalizeOptionalBranchValue } from '../branches/values.js'
import { branchesSlug } from '../collections/createBranchesCollection.js'
import { documentDataSchema } from '../contracts/common.js'
import { storedBranchSchema, type StoredBranch } from '../contracts/storedBranch.js'
import { BranchingAPIError } from '../errors.js'
import { branchRequest } from '../utilities/branchAccess.js'
import { clone, fieldPermitted, topLevelFields } from '../utilities/branchDocument.js'
import { withTransaction } from '../utilities/requestScope.js'

import { mergeBranch, type MergeBranchResult } from './mergeBranch.js'
import { normalizePick, type MergePick, type MergeRevision } from './mergeTypes.js'

export interface ApplyMergeArgs {
  branch: string
  collectionSlug: CollectionSlug
  operationId?: string
  parentId: number | string
  picks: Record<string, MergePick>
  previewToken?: string
  req: PayloadRequest
  revision?: MergeRevision
}
export interface ApplyMergeResult {
  branch: StoredBranch
  doc: Record<string, unknown>
  replayed: boolean
}
export class OperationConflictError extends Error {
  constructor() {
    super('This operation ID was already used for a different merge request')
  }
}
export class MissingPicksError extends Error {
  constructor(readonly missingFields: string[]) {
    super(`Missing merge pick for contested field(s): ${missingFields.join(', ')}`)
  }
}
export class InvalidPickError extends Error {
  constructor(readonly keys: string[]) {
    super(`Invalid merge pick key(s): ${keys.join(', ')}`)
  }
}
export class StaleMergeError extends Error {
  constructor() {
    super('Merge preview is stale; refresh and review again')
  }
}

const fingerprintOf = (args: ApplyMergeArgs): string =>
  createHash('sha256')
    .update(JSON.stringify({ picks: args.picks, revision: args.revision }))
    .digest('base64url')

const replayIfCommitted = async (
  args: ApplyMergeArgs,
  req: PayloadRequest,
  branchRow: StoredBranch,
): Promise<ApplyMergeResult | undefined> => {
  if (args.operationId === undefined || branchRow.lastMergeOperationId !== args.operationId) {
    return undefined
  }

  if (branchRow.lastMergeFingerprint !== fingerprintOf(args)) throw new OperationConflictError()

  const doc = documentDataSchema.parse(
    await req.payload.findByID({
      id: args.parentId,
      collection: args.collectionSlug,
      overrideAccess: false,
      req,
    }),
  )

  return { branch: branchRow, doc, replayed: true }
}

const revisionMatches = (given: MergeRevision | undefined, current: MergeRevision) =>
  Boolean(
    given &&
    given.targetRevision === current.targetRevision &&
    given.branchRevision === current.branchRevision,
  )

const applySelections = (
  computed: MergeBranchResult,
  picks: Record<string, MergePick>,
): { applied: Set<string>; writes: Record<string, unknown> } => {
  const conflicts = new Map(computed.contested.map((unit) => [unit.key, unit]))

  const invalid = Object.keys(picks).filter(
    (key) => !conflicts.has(key) || normalizePick(String(picks[key])) === undefined,
  )

  if (invalid.length > 0) throw new InvalidPickError(invalid)

  const missing = [...conflicts.keys()].filter(
    (key) => normalizePick(String(picks[key])) === undefined,
  )

  if (missing.length > 0) throw new MissingPicksError(missing)

  const writes: Record<string, unknown> = {}
  const applied = new Set<string>()

  for (const unit of computed.automatic) {
    for (const field of unit.fields) {
      applied.add(field)
      if (unit.source === 'branch') writes[field] = clone(computed.branchDoc[field])
    }
  }

  for (const unit of computed.contested) {
    const pick = normalizePick(String(picks[unit.key]))

    if (pick === undefined) continue

    for (const field of unit.fields) {
      applied.add(field)
      if (pick === 'branch') writes[field] = clone(computed.branchDoc[field])
    }
  }

  return { applied, writes }
}

const assertMergePermissions = async ({
  applied,
  collection,
  parentId,
  req,
}: {
  applied: Set<string>
  collection: SanitizedCollectionConfig
  parentId: number | string
  req: PayloadRequest
}): Promise<void> => {
  for (const field of topLevelFields(collection.fields)) {
    const fieldName = 'name' in field && typeof field.name === 'string' ? field.name : ''

    if (fieldName === '' || !applied.has(fieldName)) continue
    const canRead = await fieldPermitted(field, 'read', req, parentId)
    const canUpdate = await fieldPermitted(field, 'update', req, parentId)

    if (!canRead || !canUpdate) {
      throw new BranchingAPIError(
        `You do not have permission to merge field "${fieldName}"`,
        403,
        'FORBIDDEN_FIELD',
      )
    }
  }
}

const requireCollection = (req: PayloadRequest, slug: CollectionSlug) => {
  const collection = req.payload.collections[slug]?.config

  if (!collection) {
    throw new BranchingAPIError(`Unknown collection "${slug}"`, 400, 'INVALID_COLLECTION')
  }

  return collection
}

const persistedTarget = async (
  req: PayloadRequest,
  collectionSlug: CollectionSlug,
  parentId: number | string,
): Promise<Record<string, unknown>> =>
  documentDataSchema.parse(
    await req.payload.db.findOne({
      collection: collectionSlug,
      req,
      where: { id: { equals: parentId } },
    }),
  )

const rebaseline = ({
  applied,
  branch,
  persisted,
}: {
  applied: Set<string>
  branch: StoredBranch
  persisted: Record<string, unknown>
}): { overrides: Record<string, unknown>; snapshot: Record<string, unknown> } => {
  const snapshot = clone(branch.baselineSnapshot)
  const overrides = clone(branch.overrides)

  for (const field of applied) {
    const value = normalizeOptionalBranchValue(persisted[field])

    if (value !== undefined) {
      snapshot[field] = value
    } else {
      Reflect.deleteProperty(snapshot, field)
    }

    Reflect.deleteProperty(overrides, field)
  }

  return { overrides, snapshot }
}

const writeBranchBookkeeping = async ({
  args,
  computed,
  overrides,
  req,
  snapshot,
  targetUpdatedAt,
}: {
  args: ApplyMergeArgs
  computed: MergeBranchResult
  overrides: Record<string, unknown>
  req: PayloadRequest
  snapshot: Record<string, unknown>
  targetUpdatedAt: string
}): Promise<StoredBranch> => {
  const now = new Date().toISOString()

  return storedBranchSchema.parse(
    await req.payload.update({
      id: computed.branchRow.id,
      collection: branchesSlug(args.collectionSlug),
      data: {
        baselineCapturedAt: now,
        baselineRevision: targetUpdatedAt,
        baselineSnapshot: snapshot,
        diverged: Object.keys(overrides).length > 0,
        lastMergedAt: now,
        lastMergedBy: String(req.user?.id ?? ''),
        lastMergeFingerprint: args.operationId === undefined ? null : fingerprintOf(args),
        lastMergeOperationId: args.operationId ?? null,
        overrides,
        revision: computed.branchRow.revision + 1,
      },
      overrideAccess: false,
      req: await branchRequest(req),
    }),
  )
}

const applyWithinTransaction = async (
  args: ApplyMergeArgs,
  req: PayloadRequest,
): Promise<ApplyMergeResult> => {
  const { payload } = req
  const collection = requireCollection(req, args.collectionSlug)

  const computed = await mergeBranch({
    branch: args.branch,
    collectionSlug: args.collectionSlug,
    parentId: args.parentId,
    payload,
    req,
  })

  const replayed = await replayIfCommitted(args, req, computed.branchRow)

  if (replayed) return replayed

  if (
    args.previewToken !== computed.previewToken ||
    !revisionMatches(args.revision, computed.revision)
  ) {
    throw new StaleMergeError()
  }

  const { applied, writes } = applySelections(computed, args.picks)

  await assertMergePermissions({ applied, collection, parentId: args.parentId, req })

  const updated = documentDataSchema.parse(
    Object.keys(writes).length === 0
      ? await payload.findByID({
          id: args.parentId,
          collection: args.collectionSlug,
          overrideAccess: false,
          req,
        })
      : await payload.update({
          id: args.parentId,
          collection: args.collectionSlug,
          data: writes,
          overrideAccess: false,
          overrideLock: false,
          req,
        }),
  )

  const persisted = await persistedTarget(req, args.collectionSlug, args.parentId)
  const { overrides, snapshot } = rebaseline({ applied, branch: computed.branchRow, persisted })

  const updatedBranch = await writeBranchBookkeeping({
    args,
    computed,
    overrides,
    req,
    snapshot,
    targetUpdatedAt: typeof updated['updatedAt'] === 'string' ? updated['updatedAt'] : '',
  })

  return { branch: updatedBranch, doc: updated, replayed: false }
}

export const applyMerge = async (args: ApplyMergeArgs): Promise<ApplyMergeResult> => {
  if (args.previewToken == null || args.previewToken === '' || args.revision == null) {
    throw new StaleMergeError()
  }

  return withTransaction(args.req, (req) => applyWithinTransaction(args, req))
}
