import type { CollectionBeforeOperationHook, CollectionSlug, Config } from 'payload'

import { branchClosure } from './collections/branchClosure.js'
import { branches } from './collections/branches.js'
import { branchField } from './fields/branchField.js'
import { canonicalIdField } from './fields/canonicalIdField.js'
import { filterDocumentsByBranch } from './filters/filterDocumentsByBranch.js'
import { redirectReadToBranch } from './hooks/redirectReadToBranch.js'
import { redirectUpdateToBranch } from './hooks/redirectUpdateToBranch.js'
import { combineFilters } from './utilities/combineFilters.js'

export { generateBranchCookie } from './utilities/generateBranchCookie.js'
export { branchCookieName } from './utilities/getBranchFromCookie.js'

export interface PayloadPluginBranchingConfig {
  branchClosureSlug?: string
  branchesSlug?: string
  collections?: Partial<Record<CollectionSlug, true>>
  disabled?: boolean
}

const defaults = {
  branchClosureSlug: 'payload-branch-closure',
  branchesSlug: 'payload-branches',
  branchFieldName: 'branch',
  canonicalIdFieldName: 'canonicalId',
}

export const payloadPluginBranching =
  (pluginOptions: PayloadPluginBranchingConfig) =>
  (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config
    }

    const branchesSlug = pluginOptions.branchesSlug ?? defaults.branchesSlug
    const branchClosureSlug = pluginOptions.branchClosureSlug ?? defaults.branchClosureSlug

    config.collections ??= []
    config.collections.push(
      branches({ slug: branchesSlug, closureSlug: branchClosureSlug }),
      branchClosure({ slug: branchClosureSlug, branchesSlug }),
    )

    for (const collection of config.collections) {
      if (!pluginOptions.collections?.[collection.slug]) {
        continue
      }

      collection.fields.unshift(
        branchField({ name: defaults.branchFieldName, branchesSlug }),
        canonicalIdField({ name: defaults.canonicalIdFieldName }),
      )

      collection.admin ??= {}
      collection.admin.baseFilter = combineFilters({
        ...(collection.admin.baseFilter ? { baseFilter: collection.admin.baseFilter } : {}),
        customFilter: ({ req }) =>
          filterDocumentsByBranch({
            branchClosureSlug,
            branchesSlug,
            branchFieldName: defaults.branchFieldName,
            req,
          }),
      })

      collection.hooks ??= {}
      collection.hooks.beforeOperation ??= []
      collection.hooks.beforeOperation.push(
        redirectUpdateToBranch({
          branchesSlug,
          branchFieldName: defaults.branchFieldName,
          canonicalIdFieldName: defaults.canonicalIdFieldName,
          collectionSlug: collection.slug,
        }) as unknown as CollectionBeforeOperationHook,
        redirectReadToBranch({
          branchClosureSlug,
          branchesSlug,
          branchFieldName: defaults.branchFieldName,
          canonicalIdFieldName: defaults.canonicalIdFieldName,
          collectionSlug: collection.slug,
        }) as unknown as CollectionBeforeOperationHook,
      )
    }

    config.admin ??= {}
    config.admin.components ??= {}
    config.admin.components.beforeDashboard ??= []
    config.admin.components.beforeDashboard.push('payload-plugin-branching/rsc#Greeting')

    const incomingOnInit = config.onInit

    config.onInit = async (payload) => {
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }

      payload.logger.info('payload-plugin-branching initialized')
    }

    return config
  }
