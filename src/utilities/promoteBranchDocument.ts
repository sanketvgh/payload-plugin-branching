import type { CollectionSlug, PayloadRequest } from 'payload'

import { APIError } from 'payload'

import { skipBranchOperationHookContextKey } from '../hooks/branchOperationHook.js'

interface Args {
  branchFieldName: string
  canonicalIdFieldName: string
  collectionSlug: CollectionSlug
  id: number | string
  req: PayloadRequest
}

interface BranchedDoc {
  [key: string]: unknown
  id: number | string
}

// Promotes a diverged document's field values onto its canonical
// (Default-branch) row, replacing them outright (git-merge-style: the
// branch's content wins), then leaves the diverged row in place —
// mirroring Payload's own copyDataFromLocale, which never deletes the
// source it copied from. Uses a real payload.update (not a raw write),
// so hooks/access control run exactly as they would for a normal edit.
export async function promoteBranchDocument({
  id,
  branchFieldName,
  canonicalIdFieldName,
  collectionSlug,
  req,
}: Args): Promise<BranchedDoc> {
  const source = (await req.payload.findByID({
    id,
    collection: collectionSlug,
    context: { [skipBranchOperationHookContextKey]: true },
    depth: 0,
    overrideAccess: false,
    req,
    user: req.user,
  })) as BranchedDoc

  const sourceBranch = source[branchFieldName]

  if (!sourceBranch) {
    throw new APIError(
      'This document is already on the Default branch; there is nothing to promote.',
      400,
      undefined,
      true,
    )
  }

  const existingCanonicalId = source[canonicalIdFieldName] as null | string | undefined
  const targetId = existingCanonicalId ?? source.id

  const data = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) =>
        ![branchFieldName, canonicalIdFieldName, 'createdAt', 'id', 'updatedAt'].includes(key),
    ),
  )

  // When there's no separate canonical row, "promoting" means converting
  // this document into the Default one in place, so branch must be
  // explicitly cleared — a partial update merges by default, so simply
  // omitting the field (as we do above for the normal case, where the
  // target row's branch is already null) would leave it unchanged.
  if (!existingCanonicalId) {
    data[branchFieldName] = null
  }

  return (await req.payload.update({
    id: targetId,
    collection: collectionSlug,
    context: { [skipBranchOperationHookContextKey]: true },
    data,
    overrideAccess: false,
    req,
    user: req.user,
  })) as BranchedDoc
}
