import type { Field } from 'payload'
import { flattenTopLevelFields } from 'payload/shared'

const metadataFieldNames = new Set(['_status', 'createdAt', 'id', 'updatedAt'])

export type BranchableField = ReturnType<typeof flattenTopLevelFields<Field>>[number]

export const branchableFields = (fields: Field[]): BranchableField[] =>
  flattenTopLevelFields(fields).filter((field) => {
    if (!('name' in field) || typeof field.name !== 'string' || field.name === '') return false
    if (metadataFieldNames.has(field.name) || field.type === 'join') return false

    return !('virtual' in field)
  })
