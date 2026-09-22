import type { CollectionSlug } from 'payload'

import type { MergePick, MergeRevision } from '../contracts/merge.js'

export type MergeSide = 'branch' | 'main'
export type { MergePick, MergeRevision }
export const normalizePick = (pick: string): MergeSide | undefined => {
  if (pick === 'main' || pick === 'theirs') return 'main'
  if (pick === 'branch' || pick === 'yours') return 'branch'

  return undefined
}

export interface MergeUnit {
  fields: string[]
  key: string
  locale?: string
  source?: 'both' | MergeSide
}

export interface MergePreview {
  automatic: MergeUnit[]
  base: { capturedAt?: string | undefined; revision?: string | undefined; source: 'snapshot' }
  branch: { id: number | string; name: string; updatedAt?: string | undefined }
  collectionSlug?: CollectionSlug
  conflicts: MergeUnit[]
  contractVersion: 1
  previewToken: string
  revision: MergeRevision
  target: { id: number | string; revision?: string | undefined; updatedAt?: string | undefined }
}

export interface ApplyMergeRequest {
  branch: string
  collectionSlug: CollectionSlug
  parentId: number | string
  picks: Record<string, MergePick>
  previewToken?: string
  revision?: MergeRevision
}
