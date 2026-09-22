import { z } from 'zod'

import { nonEmptyStringSchema, transportIDSchema, type ContractResult } from './common.js'

const reservedKeys = new Set(['__proto__', 'constructor', 'prototype'])

export const mergePickSchema = z.enum(['branch', 'main', 'theirs', 'yours'])

export const mergePicksSchema = z
  .unknown()
  .superRefine((picks, context) => {
    if (typeof picks !== 'object' || picks === null || Array.isArray(picks)) return

    for (const key of Object.keys(picks)) {
      if (reservedKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: `Reserved merge pick key: ${key}`,
          path: [key],
        })
      }
    }
  })
  .pipe(z.record(z.string().min(1), mergePickSchema))
  .transform((picks) => Object.fromEntries(Object.entries(picks)))

export const mergeRevisionSchema = z.strictObject({
  branchRevision: nonEmptyStringSchema,
  branchUpdatedAt: nonEmptyStringSchema.optional(),
  targetRevision: nonEmptyStringSchema,
  targetUpdatedAt: nonEmptyStringSchema.optional(),
})

const applyMergeBaseSchema = z.strictObject({
  branch: nonEmptyStringSchema,
  collectionSlug: nonEmptyStringSchema,
  operationId: z.string().trim().min(1).max(128).optional(),
  parentId: transportIDSchema,
  picks: mergePicksSchema,
  previewToken: z.unknown().optional(),
  revision: z.unknown().optional(),
})

const applyMergeSchema = applyMergeBaseSchema.extend({
  previewToken: nonEmptyStringSchema,
  revision: mergeRevisionSchema,
})

export type ApplyMergeInput = z.infer<typeof applyMergeSchema>
export type MergePick = z.infer<typeof mergePickSchema>
export type MergeRevision = z.infer<typeof mergeRevisionSchema>

export const parseApplyMergeInput = (input: unknown): ContractResult<ApplyMergeInput> => {
  const baseResult = applyMergeBaseSchema.safeParse(input)

  if (!baseResult.success) {
    return { issues: baseResult.error.issues, status: 400, success: false }
  }

  const previewMissing = baseResult.data.previewToken === undefined
  const revisionMissing = baseResult.data.revision === undefined

  if (previewMissing || revisionMissing) {
    const missingResult = z
      .strictObject({
        previewToken: nonEmptyStringSchema,
        revision: mergeRevisionSchema,
      })
      .safeParse({
        previewToken: baseResult.data.previewToken,
        revision: baseResult.data.revision,
      })

    return {
      issues: missingResult.success ? [] : missingResult.error.issues,
      status: 428,
      success: false,
    }
  }

  const result = applyMergeSchema.safeParse(baseResult.data)

  return result.success
    ? { data: result.data, success: true }
    : { issues: result.error.issues, status: 400, success: false }
}
