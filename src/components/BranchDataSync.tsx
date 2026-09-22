'use client'

import { useConfig, useDocumentInfo, useForm } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation.js'
import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'

import { branchSummarySchema } from '../contracts/branches.js'
import { documentDataSchema } from '../contracts/common.js'

import { branchKey, loadedBranchRevisions } from './loadedBranchRevisions.js'

const resolvedDocumentSchema = z.object({
  branch: branchSummarySchema,
  resolvedDoc: documentDataSchema,
})

export const BranchDataSync: FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const { reset } = useForm()

  const {
    config: {
      routes: { api: apiRoute },
    },
  } = useConfig()

  const searchParams = useSearchParams()
  const branch = searchParams.get('branch')

  const loadedForRef = useRef<null | string>(null)
  const isFirstRunRef = useRef(true)
  const currentKey = `${collectionSlug ?? ''}:${String(id ?? '')}:${branch ?? ''}`

  const [readyKey, setReadyKey] = useState<null | string>(() =>
    branch == null || branch === '' ? currentKey : null,
  )

  useEffect(() => {
    if (collectionSlug == null || collectionSlug === '' || id == null) {
      return
    }

    const key = `${collectionSlug}:${String(id)}:${branch ?? ''}`

    if (loadedForRef.current === key) {
      return
    }

    const wasFirstRun = isFirstRunRef.current

    isFirstRunRef.current = false
    loadedForRef.current = key

    if (branch == null || branch === '') {
      if (wasFirstRun) {
        return
      }

      void (async () => {
        const res = await fetch(`${apiRoute}/${collectionSlug}/${String(id)}`, {
          credentials: 'include',
        })

        if (res.ok) {
          const doc = documentDataSchema.safeParse(await res.json())

          if (doc.success) await reset(doc.data)
        }

        setReadyKey(key)
      })()

      return
    }

    void (async () => {
      const res = await fetch(
        `${apiRoute}/payload-plugin-branching/branches/resolve?collectionSlug=${encodeURIComponent(
          collectionSlug,
        )}&parentId=${encodeURIComponent(String(id))}&branch=${encodeURIComponent(branch)}`,
        { credentials: 'include' },
      )

      if (res.ok) {
        const json = resolvedDocumentSchema.safeParse(await res.json())

        if (json.success) {
          loadedBranchRevisions.set(
            branchKey(collectionSlug, id, branch),
            json.data.branch.revision,
          )

          await reset(json.data.resolvedDoc)
        }
      }

      setReadyKey(key)
    })()
  }, [apiRoute, branch, collectionSlug, id, reset])

  return <span hidden data-branch-sync-ready={readyKey === currentKey ? 'true' : 'false'} />
}
