import type { PayloadRequest, Where } from 'payload'

import { getActiveBranch } from '../utilities/getActiveBranch.js'
import { getBranchAncestry } from '../utilities/getBranchAncestry.js'
import { getCollectionIDType } from '../utilities/getCollectionIDType.js'

interface Args {
  branchesSlug: string
  branchFieldName: string
  req: PayloadRequest
}

export async function filterDocumentsByBranch({
  branchesSlug,
  branchFieldName,
  req,
}: Args): Promise<null | Where> {
  const idType = getCollectionIDType({ collectionSlug: branchesSlug, payload: req.payload })
  const activeBranch = getActiveBranch({ idType, req })

  if (!activeBranch) {
    return null
  }

  // Falls back to "just the active branch, no ancestors" rather than
  // breaking the admin list view entirely if the ancestry lookup fails
  // for any reason (e.g. a stale/deleted branch id).
  const ancestry = await getBranchAncestry({
    branchesSlug,
    branchId: activeBranch,
    payload: req.payload,
  }).catch(() => [])

  return {
    or: [
      {
        [branchFieldName]: {
          in: [activeBranch, ...ancestry],
        },
      },
      {
        [branchFieldName]: {
          exists: false,
        },
      },
    ],
  }
}
