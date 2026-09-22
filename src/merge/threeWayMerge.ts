import type { MergeUnit } from '../operations/mergeTypes.js'

export type ContestedField = MergeUnit
export interface ThreeWayMergeResult<T> {
  automatic: MergeUnit[]
  contested: ContestedField[]
  merged: T
  theirFields: string[]
  yourFields: string[]
}
export interface ThreeWayMergeConfig {
  chunks?: string[][]
  setLikeFields?: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stable = (value: unknown, setLike = false): unknown => {
  if (value === undefined || value === null || value === '') return null

  if (Array.isArray(value)) {
    const items = value.map((v) => stable(v))

    return setLike && items.every((v) => v === null || typeof v !== 'object')
      ? [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      : items
  }

  if (isRecord(value)) {
    const object = value

    if ('relationTo' in object && 'value' in object)
      return { relationTo: object['relationTo'], value: stable(object['value']) }
    if (
      'id' in object &&
      Object.keys(object).every((k) => ['id', 'relationTo', 'value'].includes(k))
    )
      return object['id']

    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((k) => [k, stable(object[k])]),
    )
  }

  return value
}

const equal = (a: unknown, b: unknown, setLike = false) =>
  JSON.stringify(stable(a, setLike)) === JSON.stringify(stable(b, setLike))

const mergeUnit = <T extends Record<string, unknown>>({
  automatic,
  base,
  branch,
  contested,
  main,
  merged,
  setLike,
  theirFields,
  unit,
  yourFields,
}: {
  automatic: MergeUnit[]
  base: T
  branch: T
  contested: ContestedField[]
  main: T
  merged: Record<string, unknown>
  setLike: boolean
  theirFields: string[]
  unit: MergeUnit
  yourFields: string[]
}): void => {
  const changedMain = unit.fields.some((field) => !equal(base[field], main[field], setLike))
  const changedBranch = unit.fields.some((field) => !equal(base[field], branch[field], setLike))
  const sameSides = unit.fields.every((field) => equal(main[field], branch[field], setLike))

  if (changedMain && changedBranch && !sameSides) {
    contested.push(unit)

    return
  }

  if (changedBranch && !changedMain) {
    unit.source = 'branch'
    automatic.push(unit)
    yourFields.push(...unit.fields)
    for (const field of unit.fields) merged[field] = branch[field]

    return
  }

  if (changedMain && !changedBranch) {
    unit.source = 'main'
    automatic.push(unit)
    theirFields.push(...unit.fields)

    return
  }

  if (changedMain && changedBranch) {
    unit.source = 'both'
    automatic.push(unit)
  }
}

export function threeWayMerge(
  base: Record<string, unknown>,
  main: Record<string, unknown>,
  branch: Record<string, unknown>,
  config: ThreeWayMergeConfig = {},
): ThreeWayMergeResult<Record<string, unknown>> {
  const grouped = new Map<string, string[]>()

  for (const chunk of config.chunks ?? []) for (const field of chunk) grouped.set(field, chunk)
  const fields = [...new Set([...Object.keys(base), ...Object.keys(branch), ...Object.keys(main)])]
  const units: MergeUnit[] = []
  const seen = new Set<string>()

  for (const field of fields) {
    if (seen.has(field)) continue
    const unitFields = (grouped.get(field) ?? [field]).filter((x) => fields.includes(x))

    unitFields.forEach((x) => seen.add(x))
    units.push({ fields: unitFields, key: unitFields[0] ?? field })
  }

  const merged: Record<string, unknown> = { ...main }
  const contested: ContestedField[] = []
  const automatic: MergeUnit[] = []
  const theirFields: string[] = []
  const yourFields: string[] = []

  for (const unit of units) {
    const setLike = (config.setLikeFields ?? []).some((x) => unit.fields.includes(x))

    mergeUnit({
      automatic,
      base,
      branch,
      contested,
      main,
      merged,
      setLike,
      theirFields,
      unit,
      yourFields,
    })
  }

  return { automatic, contested, merged, theirFields, yourFields }
}
