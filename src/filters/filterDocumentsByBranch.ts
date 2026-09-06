import type { PayloadRequest, Where } from 'payload'

import { getBranchAncestry } from '../utilities/getBranchAncestry.js'
import { getBranchFromCookie } from '../utilities/getBranchFromCookie.js'
import { getCollectionIDType } from '../utilities/getCollectionIDType.js'

interface Args {
  branchClosureSlug: string
  branchesSlug: string
  branchFieldName: string
  req: PayloadRequest
}

export async function filterDocumentsByBranch({
  branchClosureSlug,
  branchesSlug,
  branchFieldName,
  req,
}: Args): Promise<null | Where> {
  const idType = getCollectionIDType({ collectionSlug: branchesSlug, payload: req.payload })
  const activeBranch = getBranchFromCookie(req.headers, idType)

  if (!activeBranch) {
    return null
  }

  const ancestry = await getBranchAncestry({
    branchClosureSlug,
    branchId: activeBranch,
    payload: req.payload,
    req,
  })

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
