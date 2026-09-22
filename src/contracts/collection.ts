import type { Payload } from 'payload'

import { branchesSlug } from '../collections/createBranchesCollection.js'

export type EnabledCollectionResult = { message: string; success: false } | { success: true }

export const validateEnabledCollection = (
  payload: Payload,
  collectionSlug: string,
): EnabledCollectionResult =>
  payload.collections[collectionSlug] && payload.collections[branchesSlug(collectionSlug)]
    ? { success: true }
    : {
        message: `Collection "${collectionSlug}" is not enabled for branching`,
        success: false,
      }
