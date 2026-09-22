import type { Payload } from 'payload'

import { branchIdentitySchema } from './branches.js'
import { validateEnabledCollection } from './collection.js'
import { parseCollectionDocumentID } from './documentID.js'

export interface ParsedBranchIdentity {
  branch: string
  collectionSlug: string
  parentId: number | string
}

export type ParseBranchIdentityResult =
  { data: ParsedBranchIdentity; success: true } | { message: string; success: false }

export const parseBranchIdentityFromURL = (
  payload: Payload,
  url: URL,
): ParseBranchIdentityResult => {
  const input = branchIdentitySchema.safeParse({
    branch: url.searchParams.get('branch'),
    collectionSlug: url.searchParams.get('collectionSlug'),
    parentId: url.searchParams.get('parentId'),
  })

  if (!input.success) {
    return { message: 'collectionSlug, parentId, and branch are required', success: false }
  }

  const enabled = validateEnabledCollection(payload, input.data.collectionSlug)

  if (!enabled.success) return enabled

  const parsedID = parseCollectionDocumentID(
    payload,
    input.data.collectionSlug,
    input.data.parentId,
  )

  return parsedID.success
    ? {
        data: {
          branch: input.data.branch,
          collectionSlug: input.data.collectionSlug,
          parentId: parsedID.id,
        },
        success: true,
      }
    : parsedID
}
