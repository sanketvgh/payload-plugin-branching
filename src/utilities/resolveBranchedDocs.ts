import type { CollectionSlug, Payload, PayloadRequest } from 'payload'

import { getActiveBranch } from './getActiveBranch.js'
import { getBranchAncestry } from './getBranchAncestry.js'
import { getCollectionIDType } from './getCollectionIDType.js'
import { pickBestBranchMatch } from './pickBestBranchMatch.js'

interface BranchedDoc {
  [key: string]: unknown
  id: number | string
}

interface Args<TDoc extends BranchedDoc> {
  branchesSlug: string
  branchFieldName: string
  canonicalIdFieldName: string
  collectionSlug: CollectionSlug
  docs: TDoc[]
  payload: Payload
  /**
   * Only `headers`/`searchParams` are read (to resolve the active branch);
   * a full `PayloadRequest` isn't required, so callers outside a hook
   * (e.g. a Next.js page) can pass a minimal object.
   */
  req?: Pick<PayloadRequest, 'headers' | 'searchParams'>
}

// For list views: `redirectReadToBranch` only resolves single-document
// reads (findByID), so a list query returns raw canonical rows even when a
// branch is active. This resolves each canonical doc's preview fields
// (title, excerpt, etc.) against the active branch's nearest diverged
// copy, while preserving the canonical `id` so links keep working through
// the existing findByID redirect. Bounded to the current page of results,
// not a fix for pagination-wide dedup (still an open problem).
export async function resolveBranchedDocs<TDoc extends BranchedDoc>({
  branchesSlug,
  branchFieldName,
  canonicalIdFieldName,
  collectionSlug,
  docs,
  payload,
  req = { headers: new Headers(), searchParams: new URLSearchParams() },
}: Args<TDoc>): Promise<TDoc[]> {
  if (docs.length === 0) {
    return docs
  }

  const idType = getCollectionIDType({ collectionSlug: branchesSlug, payload })
  const activeBranch = getActiveBranch({ idType, req: req as PayloadRequest })

  if (!activeBranch) {
    return docs
  }

  const ancestry = await getBranchAncestry({ branchesSlug, branchId: activeBranch, payload })

  const ancestryIds = [activeBranch, ...ancestry]
  const canonicalIds = docs.map((doc) => String(doc.id))

  const result = await payload.find({
    collection: collectionSlug,
    depth: 0,
    limit: 0,
    where: {
      and: [
        { [canonicalIdFieldName]: { in: canonicalIds } },
        { [branchFieldName]: { in: ancestryIds } },
      ],
    },
  })

  const divergedDocs = result.docs as BranchedDoc[]

  return docs.map((doc) => {
    const candidates = divergedDocs.filter(
      (diverged) => String(diverged[canonicalIdFieldName]) === String(doc.id),
    )
    const bestMatch = pickBestBranchMatch({ ancestryIds, branchFieldName, docs: candidates })

    return bestMatch ? { ...doc, ...bestMatch, id: doc.id } : doc
  })
}
