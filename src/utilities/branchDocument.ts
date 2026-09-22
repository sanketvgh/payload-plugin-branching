import type { Field, FieldAccess, PayloadRequest } from 'payload'
import { deepCopyObjectSimple, flattenTopLevelFields } from 'payload/shared'

import type { BranchableField } from '../branches/fields.js'

type Access = boolean | FieldAccess | undefined

const permitted = async (
  access: Access,
  req: PayloadRequest,
  id: number | string,
): Promise<boolean> => {
  if (access === undefined) return true
  if (typeof access === 'boolean') return access

  return Boolean(await access({ id, req }))
}

const childFields = (field: BranchableField | Field): Field[] => {
  if ('fields' in field && Array.isArray(field.fields)) return field.fields
  if (field.type === 'tabs') return field.tabs.flatMap((tab) => tab.fields)

  return []
}

const childrenPermitted = async (
  fields: Field[],
  operation: 'read' | 'update',
  req: PayloadRequest,
  id: number | string,
): Promise<boolean> => {
  for (const child of fields) {
    if (!(await fieldPermitted(child, operation, req, id))) return false
  }

  return true
}

export const fieldPermitted = async (
  field: BranchableField | Field,
  operation: 'read' | 'update',
  req: PayloadRequest,
  id: number | string,
): Promise<boolean> => {
  const access = 'access' in field ? field.access[operation] : undefined

  if (!(await permitted(access, req, id))) return false
  if (!(await childrenPermitted(childFields(field), operation, req, id))) return false

  return true
}
export const topLevelFields = (fields: Field[]): BranchableField[] => {
  return flattenTopLevelFields(fields)
}
export const clone = <T>(value: T): T => {
  return deepCopyObjectSimple(value)
}
export const equalJSON = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)
