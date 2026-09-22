import type {
  CollectionSlug,
  PayloadRequest,
  SanitizedCollectionConfig,
  ValidationFieldError,
} from 'payload'
import { beforeChangeTraverseFields, beforeValidateTraverseFields, ValidationError } from 'payload'

import { normalizeBranchValue } from '../branches/values.js'
import { branchesSlug } from '../collections/createBranchesCollection.js'
import { documentDataSchema } from '../contracts/common.js'
import { storedBranchSchema, type StoredBranch } from '../contracts/storedBranch.js'
import { BranchingAPIError } from '../errors.js'
import { branchRequest } from '../utilities/branchAccess.js'
import { equalJSON, fieldPermitted, topLevelFields } from '../utilities/branchDocument.js'
import { withTransaction } from '../utilities/requestScope.js'

import { resolveBranch } from './resolveBranch.js'

export interface SaveBranchArgs {
  branch: string
  collectionSlug: CollectionSlug
  data: Record<string, unknown>
  expectedRevision: number
  parentId: number | string
  req: PayloadRequest
}

export interface SaveBranchResult {
  branch: StoredBranch
  parentMetadata: Record<string, unknown>
  resolvedDoc: Record<string, unknown>
}

const collectOverrides = async ({
  data,
  existingOverrides,
  fields,
  frozenBase,
  manifest,
  parentId,
  req,
}: {
  data: Record<string, unknown>
  existingOverrides: Record<string, unknown>
  fields: ReturnType<typeof topLevelFields>
  frozenBase: Record<string, unknown>
  manifest: Record<string, unknown>
  parentId: number | string
  req: PayloadRequest
}): Promise<Record<string, unknown>> => {
  const nextOverrides: Record<string, unknown> = { ...existingOverrides }
  const metadata = new Set(['_status', 'createdAt', 'id', 'updatedAt'])

  for (const field of fields) {
    const fieldName = 'name' in field && typeof field.name === 'string' ? field.name : ''

    if (fieldName === '' || metadata.has(fieldName) || data[fieldName] === undefined) continue

    if (!Object.hasOwn(manifest, fieldName)) {
      throw new BranchingAPIError(
        `Field "${fieldName}" was not captured in this branch baseline; recreate the branch before editing it`,
        409,
        'MISSING_BASELINE',
      )
    }

    const canRead = await fieldPermitted(field, 'read', req, parentId)
    const canUpdate = await fieldPermitted(field, 'update', req, parentId)

    if (!canRead || !canUpdate)
      throw new BranchingAPIError(
        `You do not have permission to edit field "${fieldName}"`,
        403,
        'FORBIDDEN_FIELD',
      )
    const normalizedValue = normalizeBranchValue(data[fieldName])

    if (!equalJSON(normalizedValue, frozenBase[fieldName])) {
      nextOverrides[fieldName] = normalizedValue
    } else {
      Reflect.deleteProperty(nextOverrides, fieldName)
    }
  }

  return nextOverrides
}

const validateBranchDocument = async ({
  candidateDoc,
  collection,
  collectionSlug,
  parentId,
  req,
  resolvedDoc,
}: {
  candidateDoc: Record<string, unknown>
  collection: SanitizedCollectionConfig
  collectionSlug: CollectionSlug
  parentId: number | string
  req: PayloadRequest
  resolvedDoc: Record<string, unknown>
}): Promise<Record<string, unknown>> => {
  await beforeValidateTraverseFields({
    id: parentId,
    collection,
    context: req.context,
    data: candidateDoc,
    doc: resolvedDoc,
    fields: collection.fields,
    global: null,
    operation: 'update',
    overrideAccess: false,
    parentIndexPath: '',
    parentIsLocalized: false,
    parentPath: '',
    parentSchemaPath: '',
    req,
    siblingData: candidateDoc,
    siblingDoc: resolvedDoc,
  })

  const validationErrors: ValidationFieldError[] = []
  const mergeLocaleActions: (() => Promise<void> | void)[] = []

  await beforeChangeTraverseFields({
    id: parentId,
    collection,
    context: req.context,
    data: candidateDoc,
    doc: resolvedDoc,
    docWithLocales: candidateDoc,
    errors: validationErrors,
    fieldLabelPath: '',
    fields: collection.fields,
    global: null,
    mergeLocaleActions,
    operation: 'update',
    overrideAccess: false,
    parentIndexPath: '',
    parentIsLocalized: false,
    parentPath: '',
    parentSchemaPath: '',
    req,
    siblingData: candidateDoc,
    siblingDoc: resolvedDoc,
    siblingDocWithLocales: candidateDoc,
  })

  if (validationErrors.length > 0) {
    throw new ValidationError(
      { id: parentId, collection: collectionSlug, errors: validationErrors, req },
      req.t,
    )
  }

  for (const mergeLocaleAction of mergeLocaleActions) await mergeLocaleAction()

  return candidateDoc
}

const selectTransformedFields = (
  candidateDoc: Record<string, unknown>,
  submittedData: Record<string, unknown>,
): Record<string, unknown> => {
  const transformed: Record<string, unknown> = {}

  const pruneToSubmittedShape = (candidate: unknown, submitted: unknown): unknown => {
    if (Array.isArray(submitted)) return Array.isArray(candidate) ? candidate : submitted

    if (
      typeof submitted === 'object' &&
      submitted !== null &&
      !Array.isArray(submitted) &&
      typeof candidate === 'object' &&
      candidate !== null &&
      !Array.isArray(candidate)
    ) {
      const candidateResult = documentDataSchema.safeParse(candidate)
      const submittedResult = documentDataSchema.safeParse(submitted)

      if (!candidateResult.success || !submittedResult.success) return candidate

      const candidateRecord = candidateResult.data
      const submittedRecord = submittedResult.data
      const result: Record<string, unknown> = {}

      for (const fieldName of Object.keys(submittedRecord)) {
        result[fieldName] = pruneToSubmittedShape(
          candidateRecord[fieldName],
          submittedRecord[fieldName],
        )
      }

      return result
    }

    return candidate
  }

  for (const fieldName of Object.keys(submittedData)) {
    if (!Object.hasOwn(candidateDoc, fieldName)) {
      throw new BranchingAPIError(
        `Field "${fieldName}" was removed during validation and cannot be saved`,
        422,
        'FIELD_REMOVED_BY_VALIDATION',
      )
    }

    transformed[fieldName] = pruneToSubmittedShape(
      candidateDoc[fieldName],
      submittedData[fieldName],
    )
  }

  return transformed
}

const saveWithinRequest = async (
  { branch, collectionSlug, data, expectedRevision, parentId }: SaveBranchArgs,
  req: PayloadRequest,
): Promise<SaveBranchResult> => {
  const { payload } = req

  const {
    branchDoc,
    overrides: existingOverrides,
    parentMetadata,
    resolvedDoc,
  } = await resolveBranch({ branch, collectionSlug, parentId, payload, req })

  if (branchDoc.revision !== expectedRevision) {
    throw new BranchingAPIError(
      `Branch "${branch}" changed since it was loaded (revision ${String(branchDoc.revision)}, expected ${String(expectedRevision)}); reload before saving`,
      409,
      'STALE_BRANCH',
      { currentRevision: branchDoc.revision },
    )
  }

  const collectionConfig = payload.collections[collectionSlug]?.config

  if (!collectionConfig) {
    throw new BranchingAPIError(`Unknown collection "${collectionSlug}"`, 400, 'INVALID_COLLECTION')
  }

  const fields = topLevelFields(collectionConfig.fields)
  const frozenBase = branchDoc.baselineSnapshot
  const manifest = branchDoc.baselineManifest
  const overrideArgs = { existingOverrides, fields, frozenBase, manifest, parentId, req }
  const nextOverrides = await collectOverrides({ data, ...overrideArgs })

  const transformedCandidate = await validateBranchDocument({
    candidateDoc: { ...resolvedDoc, ...nextOverrides },
    collection: collectionConfig,
    collectionSlug,
    parentId,
    req,
    resolvedDoc,
  })

  const persistedOverrides = await collectOverrides({
    data: selectTransformedFields(transformedCandidate, data),
    ...overrideArgs,
  })

  const updatedBranch = storedBranchSchema.parse(
    await payload.update({
      id: branchDoc.id,
      collection: branchesSlug(collectionSlug),
      data: {
        diverged: Object.keys(persistedOverrides).length > 0,
        overrides: persistedOverrides,
        revision: branchDoc.revision + 1,
      },
      overrideAccess: false,
      req: await branchRequest(req),
    }),
  )

  return {
    branch: updatedBranch,
    parentMetadata,
    resolvedDoc: { ...frozenBase, ...persistedOverrides },
  }
}

export const saveBranch = (args: SaveBranchArgs): Promise<SaveBranchResult> =>
  withTransaction(args.req, (req) => saveWithinRequest(args, req))
