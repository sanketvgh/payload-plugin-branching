import type { UIField } from 'payload'

interface Args {
  branchesSlug: string
  branchFieldName: string
}

// `ui` fields are display-only and never included in submitted form data,
// so this is safe from the resubmission issue that hidden data fields hit
// (see redirectUpdateToBranch's incomingData stripping).
export const branchIndicatorField = ({ branchesSlug, branchFieldName }: Args): UIField => ({
  name: 'branchIndicator',
  type: 'ui',
  admin: {
    components: {
      Field: {
        clientProps: { branchesSlug, branchFieldName },
        path: 'payload-plugin-branching/rsc#BranchIndicatorField',
      },
    },
    disableListColumn: true,
    position: 'sidebar',
  },
})
