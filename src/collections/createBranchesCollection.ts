import type { CollectionConfig, CollectionSlug } from 'payload'

import { hasInternalBranchAccess } from '../utilities/branchAccess.js'

export const branchesSlug = (collectionSlug: CollectionSlug): string => `${collectionSlug}-branches`

const internal = ({ req }: { req: unknown }) => hasInternalBranchAccess(req)
const immutable = { read: internal, update: () => false }
const internallyMutable = { read: internal, update: internal }

const branchFields = (collectionSlug: CollectionSlug): CollectionConfig['fields'] => [
  {
    name: 'parent',
    type: 'relationship',
    access: immutable,
    index: true,
    relationTo: collectionSlug,
    required: true,
  },
  {
    name: 'branch',
    type: 'text',
    access: immutable,
    maxLength: 64,
    required: true,
  },
  {
    name: 'overrides',
    type: 'json',
    access: { read: internal, update: internal },
    defaultValue: {},
  },
  {
    name: 'baselineSnapshot',
    type: 'json',
    access: internallyMutable,
    admin: { readOnly: true },
  },
  {
    name: 'baselineManifest',
    type: 'json',
    access: internallyMutable,
    admin: { readOnly: true },
  },
  {
    name: 'baselineCapturedAt',
    type: 'date',
    access: internallyMutable,
    admin: { readOnly: true },
  },
  {
    name: 'baselineRevision',
    type: 'text',
    access: internallyMutable,
    admin: { readOnly: true },
  },
  {
    name: 'createdBy',
    type: 'relationship',
    access: immutable,
    admin: { readOnly: true },
    relationTo: 'users',
  },
  {
    name: 'baselineVersionId',
    type: 'text',
    access: immutable,
  },
  {
    name: 'diverged',
    type: 'checkbox',
    access: { read: internal, update: internal },
    admin: { components: { Cell: 'payload-plugin-branching/rsc#DivergedCell' } },
    defaultValue: false,
    index: true,
  },
]

const mergeBookkeepingFields: CollectionConfig['fields'] = [
  {
    name: 'revision',
    type: 'number',
    access: { read: internal, update: internal },
    defaultValue: 0,
    min: 0,
    required: true,
  },
  {
    name: 'lastMergeOperationId',
    type: 'text',
    access: { read: internal, update: internal },
  },
  {
    name: 'lastMergeFingerprint',
    type: 'text',
    access: { read: internal, update: internal },
  },
  {
    name: 'lastMergedAt',
    type: 'date',
    access: { read: internal, update: internal },
  },
  {
    name: 'lastMergedBy',
    type: 'text',
    access: { read: internal, update: internal },
  },
]

export const createBranchesCollection = (collectionSlug: CollectionSlug): CollectionConfig => ({
  slug: branchesSlug(collectionSlug),
  access: { create: internal, delete: internal, read: internal, update: internal },
  admin: {
    defaultColumns: ['branch', 'parent', 'createdBy', 'diverged', 'updatedAt', 'lastMergedAt'],
    hidden: true,
    useAsTitle: 'branch',
  },
  fields: [...branchFields(collectionSlug), ...mergeBookkeepingFields],
  indexes: [{ fields: ['parent', 'branch'], unique: true }],
})
