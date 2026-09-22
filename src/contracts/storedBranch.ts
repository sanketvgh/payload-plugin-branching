import { z } from 'zod'

import { documentDataSchema, nonEmptyStringSchema, transportIDSchema } from './common.js'

export const storedBranchSchema = z.looseObject({
  id: transportIDSchema,
  baselineCapturedAt: z.string().optional(),
  baselineManifest: z.record(z.string(), z.looseObject({ captured: z.literal(true) })),
  baselineRevision: z.string().optional(),
  baselineSnapshot: documentDataSchema,
  branch: nonEmptyStringSchema,
  createdAt: z.string().optional(),
  diverged: z.boolean().optional(),
  lastMergeFingerprint: z.string().nullish(),
  lastMergeOperationId: z.string().nullish(),
  overrides: documentDataSchema,
  parent: z.union([
    transportIDSchema,
    z.looseObject({
      id: transportIDSchema,
    }),
  ]),
  revision: z.number().int().nonnegative().default(0),
  updatedAt: z.string().optional(),
})

export type StoredBranch = z.infer<typeof storedBranchSchema>
