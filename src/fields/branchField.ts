import type { SingleRelationshipField } from 'payload'

interface Args {
  branchesSlug: string
  name: string
}

// Set by scopeCreateToBranch on create (to the active branch, or left null
// for Default) and by redirectUpdateToBranch on edit (when diverging an
// inherited document under a different branch).
export const branchField = ({ name, branchesSlug }: Args): SingleRelationshipField => ({
  name,
  type: 'relationship',
  admin: {
    allowCreate: false,
    allowEdit: false,
    disableListColumn: true,
    disableListFilter: true,
    hidden: true,
    position: 'sidebar',
  },
  hasMany: false,
  relationTo: branchesSlug,
})
