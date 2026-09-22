'use client'

import { PopupList, StaggeredShimmers } from '@payloadcms/ui'
import type { FC } from 'react'

import type { BranchRow } from './useBranches.js'

interface BranchListProps {
  activeBranch: string
  baseClass: string
  branches: BranchRow[] | null
  isError: boolean
  onRetry: () => void
  onSelect: (branchName: string) => void
}

const CurrentMarker: FC = () => <span className="sr-only">, current</span>

export const BranchList: FC<BranchListProps> = ({
  activeBranch,
  baseClass,
  branches,
  isError,
  onRetry,
  onSelect,
}) => {
  if (isError) {
    return (
      <div role="alert">
        <PopupList.GroupLabel label="Couldn't load branches" />
        <PopupList.ButtonGroup>
          <PopupList.Button onClick={onRetry}>Retry</PopupList.Button>
        </PopupList.ButtonGroup>
      </div>
    )
  }

  if (branches === null) {
    return (
      <div aria-live="polite" role="status">
        <span className="sr-only">Loading branches</span>
        <StaggeredShimmers
          className={`${baseClass}__shimmers`}
          count={3}
          height="calc(var(--base) * 1.2)"
          renderDelay={0}
          width="calc(var(--base) * 8)"
        />
      </div>
    )
  }

  return (
    <PopupList.ButtonGroup>
      <PopupList.Button
        active={activeBranch === ''}
        onClick={() => {
          onSelect('')
        }}
      >
        main
        {activeBranch === '' && <CurrentMarker />}
      </PopupList.Button>
      {branches.map((row) => (
        <PopupList.Button
          active={activeBranch === row.branch}
          key={row.id}
          onClick={() => {
            onSelect(row.branch)
          }}
        >
          <span className={`${baseClass}__name`} title={row.branch}>
            {row.branch}
          </span>
          {row.diverged && <span className={`${baseClass}__meta`}>&nbsp;(changes not merged)</span>}
          {activeBranch === row.branch && <CurrentMarker />}
        </PopupList.Button>
      ))}
    </PopupList.ButtonGroup>
  )
}
