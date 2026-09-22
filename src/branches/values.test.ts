import { describe, expect, it } from 'vitest'

import { cloneBranchValue, InvalidBranchValueError, normalizeBranchValue } from './values.js'

describe('branch value normalization', () => {
  it('matches JSON persistence semantics for dates and undefined values', () => {
    expect(
      normalizeBranchValue({
        array: [undefined, 1],
        date: new Date('2026-09-19T00:00:00.000Z'),
        omitted: undefined,
      }),
    ).toEqual({
      array: [null, 1],
      date: '2026-09-19T00:00:00.000Z',
    })
  })

  it('creates independent plain JSON copies', () => {
    const value = normalizeBranchValue({ nested: { title: 'before' } })
    const copied = cloneBranchValue(value)

    expect(copied).toEqual(value)
    expect(copied).not.toBe(value)
  })

  it('rejects cycles, unsupported primitives, and excessive depth', () => {
    const cyclic: Record<string, unknown> = {}

    cyclic['self'] = cyclic

    expect(() => normalizeBranchValue(cyclic)).toThrow(InvalidBranchValueError)
    expect(() => normalizeBranchValue(BigInt(1))).toThrow(InvalidBranchValueError)

    expect(() => normalizeBranchValue({ nested: { value: true } }, 1)).toThrow(
      InvalidBranchValueError,
    )
  })

  it('preserves unusual own keys without changing prototypes', () => {
    const input: Record<string, unknown> = { constructor: 'value', prototype: 'value' }

    Object.defineProperty(input, '__proto__', { enumerable: true, value: 'value' })

    const normalized = normalizeBranchValue(input)

    if (normalized === null || typeof normalized !== 'object' || Array.isArray(normalized)) {
      throw new Error('Expected a normalized object')
    }

    expect(Object.keys(normalized)).toEqual(['constructor', 'prototype', '__proto__'])
    expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype)
  })
})
