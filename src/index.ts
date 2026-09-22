import type { CollectionSlug, Config } from 'payload'

import { createBranchesCollection } from './collections/createBranchesCollection.js'
import { applyMergeEndpoint } from './endpoints/applyMerge.js'
import { createBranchEndpoint } from './endpoints/createBranch.js'
import { listBranchesEndpoint } from './endpoints/listBranches.js'
import { mergeBranchPreviewEndpoint } from './endpoints/mergeBranch.js'
import { resolveBranchEndpoint } from './endpoints/resolveBranch.js'
import { saveBranchEndpoint } from './endpoints/saveBranch.js'

export interface PayloadPluginBranchingConfig {
  collections?: Partial<Record<CollectionSlug, true>>
  disabled?: boolean
}

type CollectionConfig = NonNullable<Config['collections']>[number]

const configureCollection = (targetCollection: CollectionConfig, slug: string): void => {
  targetCollection.admin ??= {}
  targetCollection.admin.components ??= {}
  targetCollection.admin.components.edit ??= {}
  targetCollection.admin.components.edit.beforeDocumentControls ??= []

  targetCollection.admin.components.edit.beforeDocumentControls.push(
    'payload-plugin-branching/rsc#BranchSwitcher',
    'payload-plugin-branching/rsc#MergeReviewButton',
    'payload-plugin-branching/rsc#BranchDataSync',
  )

  targetCollection.admin.components.edit.SaveButton ??=
    'payload-plugin-branching/rsc#BranchSaveButton'

  const views = (targetCollection.admin.components.views ??= {})
  const editViews = views.edit ?? {}

  if (Object.hasOwn(editViews, 'root')) {
    throw new Error(
      `payload-plugin-branching: collection "${slug}" uses a root document view that cannot be combined with branchMerge`,
    )
  }

  if (
    Object.hasOwn(editViews, 'branchMerge') ||
    Object.values(editViews).some(
      (view) => typeof view === 'object' && 'path' in view && view.path === '/branch-merge/:branch',
    )
  ) {
    throw new Error(
      `payload-plugin-branching: custom document view key "branchMerge" or path "/branch-merge/:branch" already exists for collection "${slug}"`,
    )
  }

  Object.defineProperty(editViews, 'branchMerge', {
    configurable: true,
    enumerable: true,
    value: {
      Component: 'payload-plugin-branching/rsc#BranchMergeView',
      path: '/branch-merge/:branch',
    },
    writable: true,
  })

  views.edit = editViews
}

export const payloadPluginBranching =
  (pluginOptions: PayloadPluginBranchingConfig) =>
  (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config
    }

    const enabledSlugs = Object.keys(pluginOptions.collections ?? {})
    const existingSlugs = new Set((config.collections ?? []).map((collection) => collection.slug))

    config.collections ??= []

    for (const slug of enabledSlugs) {
      if (!existingSlugs.has(slug)) {
        throw new Error(
          `payload-plugin-branching: collection "${slug}" is opted in but not defined in config.collections`,
        )
      }

      config.collections.push(createBranchesCollection(slug))

      const targetCollection = config.collections.find((collection) => collection.slug === slug)

      if (targetCollection) configureCollection(targetCollection, slug)
    }

    if (enabledSlugs.length > 0) {
      config.endpoints ??= []

      config.endpoints.push(
        createBranchEndpoint,
        resolveBranchEndpoint,
        saveBranchEndpoint,
        listBranchesEndpoint,
        mergeBranchPreviewEndpoint,
        applyMergeEndpoint,
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
