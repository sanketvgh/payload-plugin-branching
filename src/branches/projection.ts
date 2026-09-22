import type { PayloadRequest, SanitizedCollectionConfig } from 'payload'

import { branchSummarySchema, type BranchSummary } from '../contracts/branches.js'
import { storedBranchSchema } from '../contracts/storedBranch.js'
import { fieldPermitted } from '../utilities/branchDocument.js'

import { branchableFields } from './fields.js'

const branchSummarySourceSchema = branchSummarySchema
  .loose()
  .partial({ diverged: true, revision: true })

export const projectBranchSummary = (value: unknown): BranchSummary => {
  const result = branchSummarySourceSchema.safeParse(value)

  if (!result.success) throw new Error('Stored branch metadata is invalid')

  return {
    id: result.data.id,
    branch: result.data.branch,
    diverged: result.data.diverged ?? false,
    revision: result.data.revision ?? 0,
  }
}

export const projectResolvedBranchDocument = async ({
  branchRow,
  collection,
  parentId,
  req,
}: {
  branchRow: unknown
  collection: SanitizedCollectionConfig
  parentId: number | string
  req: PayloadRequest
}): Promise<Record<string, unknown>> => {
  const parsed = storedBranchSchema.safeParse(branchRow)

  if (!parsed.success) throw new Error('Stored branch data is missing or invalid')
  const resolved: Record<string, unknown> = {}

  for (const field of branchableFields(collection.fields)) {
    const fieldName = 'name' in field && typeof field.name === 'string' ? field.name : ''

    if (
      fieldName === '' ||
      !Object.hasOwn(parsed.data.baselineManifest, fieldName) ||
      !(await fieldPermitted(field, 'read', req, parentId))
    ) {
      continue
    }

    if (Object.hasOwn(parsed.data.overrides, fieldName)) {
      resolved[fieldName] = parsed.data.overrides[fieldName]
    } else if (Object.hasOwn(parsed.data.baselineSnapshot, fieldName)) {
      resolved[fieldName] = parsed.data.baselineSnapshot[fieldName]
    }
  }

  return resolved
}
