import type { CollectionSlug, Config } from 'payload'

export interface PayloadPluginBranchingConfig {
  /**
   * List of collections to enable branching for
   */
  collections?: Partial<Record<CollectionSlug, true>>
  disabled?: boolean
}

export const payloadPluginBranching =
  (pluginOptions: PayloadPluginBranchingConfig) =>
  (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config
    }

    const incomingOnInit = config.onInit

    config.onInit = async (payload) => {
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }
    }

    return config
  }
