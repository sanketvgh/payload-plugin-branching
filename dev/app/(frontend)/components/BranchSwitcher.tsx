'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { branchQueryParamName } from 'payload-plugin-branching'
import { useTransition } from 'react'

interface Branch {
  id: string
  name: string
}

type Args = {
  branches: Branch[]
}

const BranchSwitcher = ({ branches }: Args) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const activeBranchId = searchParams.get(branchQueryParamName)

  const selectBranch = (branchId: null | string) => {
    const params = new URLSearchParams(searchParams)

    if (branchId) {
      params.set(branchQueryParamName, branchId)
    } else {
      params.delete(branchQueryParamName)
    }

    const query = params.toString()

    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname)
    })
  }

  const options: Branch[] = [{ id: '', name: 'Default' }, ...branches]

  return (
    <div className="branch-switcher">
      {options.map((option) => {
        const isActive = (activeBranchId ?? '') === option.id

        return (
          <button
            className={`branch-switcher__pill${isActive ? ' branch-switcher__pill--active' : ''}`}
            disabled={isPending}
            key={option.id || 'default'}
            onClick={() => {
              selectBranch(option.id || null)
            }}
            type="button"
          >
            {option.name}
          </button>
        )
      })}
    </div>
  )
}

export default BranchSwitcher
