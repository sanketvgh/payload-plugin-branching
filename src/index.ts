import type { CollectionSlug, Config } from 'payload'

import { branches } from './collections/branches.js'
import { promoteToDefaultEndpoint } from './endpoints/promoteToDefaultEndpoint.js'
import { branchField } from './fields/branchField.js'
import { branchIndicatorField } from './fields/branchIndicatorField.js'
import { canonicalIdField } from './fields/canonicalIdField.js'
import { filterDocumentsByBranch } from './filters/filterDocumentsByBranch.js'
import { branchOperationHook } from './hooks/branchOperationHook.js'
import { combineFilters } from './utilities/combineFilters.js'

export { generateBranchCookie } from './utilities/generateBranchCookie.js'
export { branchCookieName, branchQueryParamName } from './utilities/getActiveBranch.js'
export { resolveBranchedDocs } from './utilities/resolveBranchedDocs.js'

export interface PayloadPluginBranchingConfig {
  /**
   * The slug for the branches collection.
   *
   * @default 'payload-branches'
   */
  branchesSlug?: string
  /**
   * Name of the hidden field storing which branch a document belongs to.
   *
   * @default 'branch'
   */
  branchFieldName?: string
  /**
   * Name of the hidden field linking a diverged document back to its base
   * (Default-branch) row.
   *
   * @default 'canonicalId'
   */
  canonicalIdFieldName?: string
  /**
   * Collections to add branch-scoping to.
   */
  collections?: Partial<Record<CollectionSlug, true>>
  /**
   * Disables the plugin while still returning a valid config.
   *
   * @default false
   */
  disabled?: boolean
}

const defaults = {
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
    const branchFieldName = pluginOptions.branchFieldName ?? defaults.branchFieldName
    const canonicalIdFieldName = pluginOptions.canonicalIdFieldName ?? defaults.canonicalIdFieldName

    config.collections ??= []
    config.collections.push(branches({ slug: branchesSlug }))

    for (const collection of config.collections) {
      if (!pluginOptions.collections?.[collection.slug]) {
        continue
      }

      collection.fields.unshift(
        branchField({ name: branchFieldName, branchesSlug }),
        canonicalIdField({ name: canonicalIdFieldName }),
        branchIndicatorField({ branchesSlug, branchFieldName }),
      )

      collection.admin ??= {}
      collection.admin.baseFilter = combineFilters({
        ...(collection.admin.baseFilter ? { baseFilter: collection.admin.baseFilter } : {}),
        customFilter: ({ req }) =>
          filterDocumentsByBranch({
            branchesSlug,
            branchFieldName,
            req,
          }),
      })

      collection.hooks ??= {}
      collection.hooks.beforeOperation ??= []
      collection.hooks.beforeOperation.push(
        branchOperationHook({
          branchesSlug,
          branchFieldName,
          canonicalIdFieldName,
          collectionSlug: collection.slug,
        }),
      )

      if (collection.endpoints !== false) {
        collection.endpoints ??= []
        collection.endpoints.push(
          promoteToDefaultEndpoint({
            branchFieldName,
            canonicalIdFieldName,
            collectionSlug: collection.slug,
          }),
        )
      }
    }

    config.admin ??= {}
    config.admin.components ??= {}
    config.admin.components.beforeDashboard ??= []
    config.admin.components.beforeDashboard.push('payload-plugin-branching/rsc#Greeting')

    const hasBranchScopedCollections = Object.keys(pluginOptions.collections ?? {}).length > 0

    if (hasBranchScopedCollections) {
      config.admin.components.beforeNav ??= []
      config.admin.components.beforeNav.push({
        clientProps: { branchesSlug },
        path: 'payload-plugin-branching/rsc#BranchSelector',
      })
    }

    const incomingOnInit = config.onInit

    config.onInit = async (payload) => {
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }

      payload.logger.info('payload-plugin-branching initialized')
    }

    return config
  }
