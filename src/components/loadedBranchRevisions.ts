const revisions = new Map<string, number>()

export const branchKey = (
  collectionSlug: string,
  parentId: number | string,
  branch: string,
): string => `${collectionSlug}:${String(parentId)}:${branch}`

export const loadedBranchRevisions = {
  clear: (key: string): void => {
    revisions.delete(key)
  },
  get: (key: string): number | undefined => revisions.get(key),
  set: (key: string, revision: number): void => {
    revisions.set(key, revision)
  },
}
