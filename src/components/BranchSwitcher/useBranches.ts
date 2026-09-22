'use client'

import { useConfig } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { useCallback, useEffect, useState } from 'react'

import { fetchAllBranches, type BranchRow } from './branchPagination.js'

export type { BranchRow } from './branchPagination.js'

interface UseBranchesArgs {
  collectionSlug: string | undefined
  parentId: null | number | string | undefined
}

export const useBranches = ({
  collectionSlug,
  parentId,
}: UseBranchesArgs): {
  branches: BranchRow[] | null
  isError: boolean
  refresh: () => void
} => {
  const {
    config: {
      routes: { api: apiRoute },
      serverURL,
    },
  } = useConfig()

  const [branches, setBranches] = useState<BranchRow[] | null>(null)
  const [isError, setIsError] = useState(false)
  const [cacheBust, setCacheBust] = useState(0)

  const refresh = useCallback(() => {
    setCacheBust((value) => value + 1)
  }, [])

  const baseURL = formatAdminURL({
    apiRoute,
    path: '/payload-plugin-branching/branches/list',
    serverURL,
  })

  useEffect(() => {
    setBranches(null)
  }, [baseURL, collectionSlug, parentId])

  useEffect(() => {
    const controller = new AbortController()

    setIsError(false)

    if (collectionSlug == null || collectionSlug === '' || parentId == null) {
      return () => {
        controller.abort()
      }
    }

    void fetchAllBranches(baseURL, collectionSlug, parentId, controller.signal).then(
      (docs) => {
        setBranches(docs)
      },
      () => {
        if (!controller.signal.aborted) {
          setIsError(true)
          setBranches(null)
        }
      },
    )

    return () => {
      controller.abort()
    }
  }, [baseURL, cacheBust, collectionSlug, parentId])

  return { branches, isError, refresh }
}
