import { describe, expect, it } from 'vitest'

import { parseDocumentID } from './documentID.js'
import { parseApplyMergeInput } from './merge.js'
import { storedBranchSchema } from './storedBranch.js'

const validRequest = () => ({
  branch: 'feature',
  collectionSlug: 'posts',
  parentId: '00123',
  picks: { title: 'branch' },
  previewToken: 'preview-token',
  revision: {
    branchRevision: 'branch-revision',
    targetRevision: 'target-revision',
  },
})

describe('document ID contracts', () => {
  it('preserves numeric-looking text IDs', () => {
    expect(parseDocumentID('00123', 'string')).toEqual({ id: '00123', success: true })
  })

  it('converts only valid numeric collection IDs', () => {
    expect(parseDocumentID('123', 'number')).toEqual({ id: 123, success: true })
    expect(parseDocumentID('00123', 'number').success).toBe(false)
    expect(parseDocumentID(Number.POSITIVE_INFINITY, 'number').success).toBe(false)
    expect(parseDocumentID(Number.MAX_SAFE_INTEGER + 1, 'number').success).toBe(false)
  })
})

describe('apply merge request contract', () => {
  it('requires the complete preview precondition', () => {
    const missing = validRequest()

    Reflect.deleteProperty(missing, 'revision')

    expect(parseApplyMergeInput(missing)).toMatchObject({ status: 428, success: false })
  })

  it('rejects malformed supplied revisions and picks', () => {
    const incompleteRevision = validRequest()

    Reflect.deleteProperty(incompleteRevision.revision, 'targetRevision')

    expect(parseApplyMergeInput(incompleteRevision)).toMatchObject({ status: 400, success: false })

    expect(parseApplyMergeInput({ ...validRequest(), picks: [] })).toMatchObject({
      status: 400,
      success: false,
    })
  })

  it('rejects reserved own keys without prototype mutation', () => {
    const picks: Record<string, unknown> = {}

    Object.defineProperty(picks, '__proto__', { enumerable: true, value: 'main' })

    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)

    const result = parseApplyMergeInput({ ...validRequest(), picks })

    expect(result).toMatchObject({ status: 400, success: false })
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)
  })

  it('returns inferred request data without coercing its transport ID', () => {
    const result = parseApplyMergeInput(validRequest())

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.parentId).toBe('00123')
  })
})

describe('stored branch compatibility', () => {
  it('rejects legacy rows without a frozen baseline', () => {
    const legacyRow = {
      id: 'legacy-branch',
      branch: 'feature',
      overrides: { title: 'Draft title' },
      parent: 'parent-1',
    }

    expect(storedBranchSchema.safeParse(legacyRow).success).toBe(false)
  })
})
