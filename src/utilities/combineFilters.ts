import type { BaseFilter, Where } from 'payload'

interface Args {
  baseFilter?: BaseFilter
  customFilter: BaseFilter
}

export const combineFilters =
  ({ baseFilter, customFilter }: Args): BaseFilter =>
  async (args) => {
    const filterConstraints = []

    if (typeof baseFilter === 'function') {
      const baseFilterResult = await baseFilter(args)

      if (baseFilterResult) {
        filterConstraints.push(baseFilterResult)
      }
    }

    const customFilterResult = await customFilter(args)

    if (customFilterResult) {
      filterConstraints.push(customFilterResult)
    }

    if (filterConstraints.length) {
      const combinedWhere: Where = { and: [] }
      filterConstraints.forEach((constraint) => {
        if (combinedWhere.and) {
          combinedWhere.and.push(constraint)
        }
      })
      return combinedWhere
    }

    return null
  }
