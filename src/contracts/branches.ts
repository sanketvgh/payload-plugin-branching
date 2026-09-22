import { z } from 'zod'

import { documentDataSchema, nonEmptyStringSchema, transportIDSchema } from './common.js'

export const branchNameSchema = z.string().trim().min(1).max(64)

export const branchIdentitySchema = z.strictObject({
  branch: branchNameSchema,
  collectionSlug: nonEmptyStringSchema,
  parentId: transportIDSchema,
})

export const createBranchInputSchema = z.strictObject({
  branchName: branchNameSchema,
  collectionSlug: nonEmptyStringSchema,
  copyFrom: z.enum(['main', 'published']).optional(),
  parentId: transportIDSchema,
})

export const revisionSchema = z.coerce.number().int().nonnegative()

export const saveBranchInputSchema = branchIdentitySchema.extend({
  data: documentDataSchema,
  expectedRevision: revisionSchema,
})

export const listBranchesInputSchema = z.strictObject({
  collectionSlug: nonEmptyStringSchema,
  limit: z.number().int().positive().max(100).default(100),
  page: z.number().int().positive().default(1),
  parentId: transportIDSchema,
})

export const branchSummarySchema = z.strictObject({
  id: transportIDSchema,
  branch: branchNameSchema,
  diverged: z.boolean(),
  revision: z.number().int().nonnegative(),
})

export type BranchIdentity = z.infer<typeof branchIdentitySchema>
export type BranchSummary = z.infer<typeof branchSummarySchema>
export type CreateBranchInput = z.infer<typeof createBranchInputSchema>
export type ListBranchesInput = z.infer<typeof listBranchesInputSchema>
export type SaveBranchInput = z.infer<typeof saveBranchInputSchema>
