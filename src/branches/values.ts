import { deepCopyObjectSimple } from 'payload/shared'

export type NormalizedJSON =
  { [key: string]: NormalizedJSON } | boolean | NormalizedJSON[] | null | number | string

export class InvalidBranchValueError extends Error {}

const normalizeValue = (
  value: unknown,
  ancestors: WeakSet<object>,
  depth: number,
  maxDepth: number,
): NormalizedJSON | undefined => {
  if (depth > maxDepth) throw new InvalidBranchValueError(`Branch value exceeds depth ${maxDepth}`)
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value

  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new InvalidBranchValueError('Branch values cannot contain non-finite numbers')

    return value
  }

  if (value === undefined) return undefined

  if (typeof value !== 'object') {
    throw new InvalidBranchValueError(`Branch values cannot contain ${typeof value} values`)
  }

  if (value instanceof Date) return value.toISOString()
  if (ancestors.has(value)) throw new InvalidBranchValueError('Branch values cannot contain cycles')

  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeValue(item, ancestors, depth + 1, maxDepth) ?? null)
    }

    const entries: [string, NormalizedJSON][] = []

    for (const [key, item] of Object.entries(value)) {
      const normalized = normalizeValue(item, ancestors, depth + 1, maxDepth)

      if (normalized !== undefined) entries.push([key, normalized])
    }

    return Object.fromEntries(entries)
  } finally {
    ancestors.delete(value)
  }
}

export const normalizeOptionalBranchValue = (
  value: unknown,
  maxDepth = 100,
): NormalizedJSON | undefined => normalizeValue(value, new WeakSet(), 0, maxDepth)

export const normalizeBranchValue = (value: unknown, maxDepth = 100): NormalizedJSON => {
  const normalized = normalizeOptionalBranchValue(value, maxDepth)

  if (normalized === undefined) {
    throw new InvalidBranchValueError('A top-level branch value cannot be undefined')
  }

  return normalized
}

export const cloneBranchValue = (value: NormalizedJSON): NormalizedJSON =>
  deepCopyObjectSimple(value)

export const equalBranchValues = (left: NormalizedJSON, right: NormalizedJSON): boolean =>
  JSON.stringify(left) === JSON.stringify(right)
