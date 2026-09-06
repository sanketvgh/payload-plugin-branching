import type { CollectionConfig } from 'payload'

interface Args {
  branchesSlug: string
  slug: string
}

export const branchClosure = ({ slug, branchesSlug }: Args): CollectionConfig => ({
  slug,
  admin: {
    hidden: false,
  },
  fields: [
    {
      name: 'ancestor',
      type: 'relationship',
      relationTo: branchesSlug,
      required: true,
    },
    {
      name: 'descendant',
      type: 'relationship',
      relationTo: branchesSlug,
      required: true,
    },
    {
      name: 'depth',
      type: 'number',
      required: true,
    },
  ],
})
