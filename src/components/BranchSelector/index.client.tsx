'use client'

import { SelectInput } from '@payloadcms/ui'
import { useRouter } from 'next/navigation.js'
import React from 'react'

import { branchCookieName } from '../../utilities/getActiveBranch.js'

interface Branch {
  id: string
  name: string
}

interface Props {
  activeBranchId: null | string
  branches: Branch[]
}

export const BranchSelectorClient = ({ activeBranchId, branches }: Props) => {
  const router = useRouter()
  const [isSwitching, setIsSwitching] = React.useState(false)

  const switchBranch = React.useCallback(
    async (id: null | string) => {
      setIsSwitching(true)

      try {
        await fetch('/api/payload-branches/switch-active-branch', {
          body: JSON.stringify({ id }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        router.refresh()
      } finally {
        setIsSwitching(false)
      }
    },
    [router],
  )

  return (
    <div className="branch-selector" style={{ marginBottom: 'var(--base)' }}>
      <SelectInput
        isClearable
        label="Active branch"
        name={branchCookieName}
        onChange={(option) => {
          const value = option && 'value' in option ? (option.value as string) : null
          void switchBranch(value)
        }}
        options={branches.map((branch) => ({ label: branch.name, value: branch.id }))}
        path={branchCookieName}
        readOnly={isSwitching}
        value={activeBranchId ?? ''}
      />
    </div>
  )
}
