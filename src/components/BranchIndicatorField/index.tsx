import type { ServerFieldBase } from 'payload'

import { FieldDescription, Pill } from '@payloadcms/ui'

import { getActiveBranch } from '../../utilities/getActiveBranch.js'
import { getCollectionIDType } from '../../utilities/getCollectionIDType.js'

type Props = {
  branchesSlug: string
  branchFieldName: string
} & ServerFieldBase

const Wrapper = ({
  children,
  description,
  label,
  pillStyle,
}: {
  children: string
  description: string
  label: string
  pillStyle: 'light-gray' | 'success' | 'warning'
}) => (
  <div className="branch-indicator">
    <label className="field-label">{label}</label>
    <Pill pillStyle={pillStyle} size="small">
      {children}
    </Pill>
    <FieldDescription description={description} marginPlacement="top" path="branchIndicator" />
  </div>
)

export const BranchIndicatorField = async ({
  branchesSlug,
  branchFieldName,
  data,
  operation,
  payload,
  req,
}: Props) => {
  const idType = getCollectionIDType({ collectionSlug: branchesSlug, payload })
  const activeBranch = getActiveBranch({ idType, req })

  if (operation === 'create') {
    if (!activeBranch) {
      return null
    }

    const branch = await payload
      .findByID({ id: activeBranch, collection: branchesSlug, depth: 0 })
      .catch(() => null)

    if (!branch) {
      payload.logger.warn(
        `payload-plugin-branching: active branch cookie references branch id "${String(activeBranch)}", which no longer exists. Switch to a valid branch to clear this.`,
      )

      return (
        <Wrapper
          description="Your active branch no longer exists (it may have been deleted). Switch to a valid branch, or Default, from the sidebar."
          label="Active branch"
          pillStyle="warning"
        >
          Unknown branch
        </Wrapper>
      )
    }

    const branchName = String(branch.name)

    return (
      <Wrapper
        description={`This document will be created on the ${branchName} branch and won't be visible on Default or other branches until promoted.`}
        label="Will be created on"
        pillStyle="warning"
      >
        {branchName}
      </Wrapper>
    )
  }

  const ownBranch = data[branchFieldName] as
    { id: number | string; name?: string } | null | number | string

  if (!ownBranch) {
    return (
      <Wrapper
        description="This document is inherited by every branch until edited under a specific branch."
        label="Branch"
        pillStyle="light-gray"
      >
        Default (shared)
      </Wrapper>
    )
  }

  const ownBranchId = typeof ownBranch === 'object' ? ownBranch.id : ownBranch
  const branch = await payload
    .findByID({ id: ownBranchId, collection: branchesSlug, depth: 0 })
    .catch(() => null)

  if (!branch) {
    payload.logger.warn(
      `payload-plugin-branching: document ${String(data.id)} in collection "${String(data.collection ?? '')}" references branch id "${String(ownBranchId)}", which no longer exists.`,
    )

    return (
      <Wrapper
        description="This document references a branch that no longer exists (it may have been deleted). Edit it under Default or a valid branch to fix this."
        label="Branch"
        pillStyle="warning"
      >
        Unknown branch
      </Wrapper>
    )
  }

  const branchName = String(branch.name)

  return (
    <Wrapper
      description={`This is a diverged copy only visible on the ${branchName} branch (and its descendants).`}
      label="Branch"
      pillStyle="success"
    >
      {branchName}
    </Wrapper>
  )
}
