import type { Payload } from 'payload'
import { getCollectionIDFieldTypes } from 'payload'

export type DocumentIDResult =
  { id: number | string; success: true } | { message: string; success: false }

export const parseDocumentID = (value: unknown, idType: 'number' | 'string'): DocumentIDResult => {
  if (idType === 'string') {
    return typeof value === 'string' && value.length > 0
      ? { id: value, success: true }
      : { message: 'Document ID must be a non-empty string', success: false }
  }

  let numericValue = Number.NaN

  if (typeof value === 'number') numericValue = value
  else if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
    numericValue = Number(value)
  }

  return Number.isSafeInteger(numericValue) && numericValue > 0
    ? { id: numericValue, success: true }
    : { message: 'Document ID must be a positive safe integer', success: false }
}

export const parseCollectionDocumentID = (
  payload: Payload,
  collectionSlug: string,
  value: unknown,
): DocumentIDResult => {
  const idTypes = getCollectionIDFieldTypes({
    config: payload.config,
    defaultIDType: payload.config.db.defaultIDType,
  })

  const idType = idTypes[collectionSlug]

  return idType === undefined
    ? { message: `Unknown collection "${collectionSlug}"`, success: false }
    : parseDocumentID(value, idType)
}
