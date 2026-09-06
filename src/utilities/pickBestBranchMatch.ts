interface BranchedDoc {
  [key: string]: unknown
  id: number | string
}

interface Args {
  ancestryIds: (number | string)[]
  branchFieldName: string
  docs: BranchedDoc[]
}

// Shared by redirectReadToBranch (single document) and
// resolveBranchedDocs (list previews): given candidate rows already
// filtered to a document's canonical group, picks whichever is scoped to
// the nearest branch in the active branch's ancestry (index 0 = the active
// branch itself, higher indexes = more distant ancestors).
export function pickBestBranchMatch({
  ancestryIds,
  branchFieldName,
  docs,
}: Args): BranchedDoc | null {
  let bestMatch: BranchedDoc | null = null
  let bestRank = Infinity

  for (const doc of docs) {
    const branchValue = doc[branchFieldName]
    const branchId =
      branchValue && typeof branchValue === 'object' && 'id' in branchValue
        ? (branchValue as { id: number | string }).id
        : (branchValue as null | number | string)

    const rank = ancestryIds.findIndex((id) => String(id) === String(branchId))

    if (rank !== -1 && rank < bestRank) {
      bestRank = rank
      bestMatch = doc
    }
  }

  return bestMatch
}
