import type { CollectionSlug, Config } from 'payload'

export interface PayloadPluginBranchingConfig {
  collections?: Partial<Record<CollectionSlug, true>>
  disabled?: boolean
}

export const payloadPluginBranching =
  (pluginOptions: PayloadPluginBranchingConfig) =>
  (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config
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
