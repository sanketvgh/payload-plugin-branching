import type { SingleRelationshipField } from 'payload'

interface Args {
  branchesSlug: string
  name: string
}

// New documents always land on the default branch regardless of which
// branch is active at creation time, only diverging later via
// redirectUpdateToBranch when someone edits them on a branch. This keeps
// every branch seeing every document by default (git-like inheritance),
// with isolation only kicking in on edit.
export const branchField = ({ name, branchesSlug }: Args): SingleRelationshipField => ({
  name,
  type: 'relationship',
  admin: {
    allowCreate: false,
    allowEdit: false,
    disableListColumn: true,
    disableListFilter: true,
    position: 'sidebar',
  },
  hasMany: false,
  relationTo: branchesSlug,
})
