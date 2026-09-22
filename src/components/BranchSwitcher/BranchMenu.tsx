'use client'

import { PopupList } from '@payloadcms/ui'
import type { FC } from 'react'
import { Fragment } from 'react'

import { BranchList } from './BranchList.js'
import type { BranchRow } from './useBranches.js'

interface BranchMenuProps {
  activeBranch: string
  baseClass: string
  branches: BranchRow[] | null
  isError: boolean
  onCreate: () => void
  onRetry: () => void
  onSelect: (branchName: string) => void
}

export const BranchMenu: FC<BranchMenuProps> = ({
  activeBranch,
  baseClass,
  branches,
  isError,
  onCreate,
  onRetry,
  onSelect,
}) => (
  <Fragment>
    <PopupList.ButtonGroup>
      <PopupList.Button onClick={onCreate}>New branch</PopupList.Button>
    </PopupList.ButtonGroup>
    <PopupList.Divider />
    <PopupList.GroupLabel label="Switch to" />
    <BranchList
      activeBranch={activeBranch}
      baseClass={baseClass}
      branches={branches}
      isError={isError}
      onRetry={onRetry}
      onSelect={onSelect}
    />
  </Fragment>
)
