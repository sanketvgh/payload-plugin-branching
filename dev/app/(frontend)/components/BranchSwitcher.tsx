'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface Branch {
  id: string
  name: string
}

type Args = {
  activeBranchId: null | string
  branches: Branch[]
}

const BranchSwitcher = ({ activeBranchId, branches }: Args) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const onChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const branchId = event.target.value || null

    await fetch('/api/branch', {
      body: JSON.stringify({ branchId }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <select
      defaultValue={activeBranchId ?? ''}
      disabled={isPending}
      onChange={(event) => {
        void onChange(event)
      }}
    >
      <option value="">Default</option>
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </select>
  )
}

export default BranchSwitcher
