import type { CollectionSlug, Payload } from 'payload'

interface Args {
  collectionSlug: CollectionSlug
  payload: Payload
}

export const getCollectionIDType = ({ collectionSlug, payload }: Args): 'number' | 'text' =>
  payload.collections[collectionSlug]?.customIDType ?? payload.db.defaultIDType
