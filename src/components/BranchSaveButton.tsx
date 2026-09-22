'use client'

import {
  Button,
  SaveButton,
  toast,
  useConfig,
  useDocumentInfo,
  useForm,
  useFormModified,
} from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation.js'
import type { FC } from 'react'
import { useCallback } from 'react'
import { z } from 'zod'

import { branchSummarySchema } from '../contracts/branches.js'

import { branchKey, loadedBranchRevisions } from './loadedBranchRevisions.js'

const resolvedBranchSchema = z.object({ branch: branchSummarySchema })

export const BranchSaveButton: FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const { submit } = useForm()
  const modified = useFormModified()

  const {
    config: {
      routes: { api: apiRoute },
      serverURL,
    },
  } = useConfig()

  const searchParams = useSearchParams()
  const branch = searchParams.get('branch')

  const handleSave = useCallback(() => {
    if (
      collectionSlug == null ||
      collectionSlug === '' ||
      id == null ||
      branch == null ||
      branch === ''
    ) {
      return
    }

    const revision = loadedBranchRevisions.get(branchKey(collectionSlug, id, branch))

    if (revision === undefined) {
      toast.error('Branch data has not finished loading; try again in a moment')

      return
    }

    const identity = `collectionSlug=${encodeURIComponent(collectionSlug)}&parentId=${encodeURIComponent(
      String(id),
    )}&branch=${encodeURIComponent(branch)}`

    const base = `${serverURL}${apiRoute}/payload-plugin-branching/branches`

    void (async () => {
      const result = await submit({
        action: `${base}/save?${identity}&expectedRevision=${String(revision)}`,
        method: 'POST',
      })

      if (!result || !result.res.ok) return

      const res = await fetch(`${base}/resolve?${identity}`, { credentials: 'include' })

      if (!res.ok) return
      const json = resolvedBranchSchema.safeParse(await res.json())

      if (json.success) {
        loadedBranchRevisions.set(branchKey(collectionSlug, id, branch), json.data.branch.revision)
      }
    })()
  }, [apiRoute, branch, collectionSlug, id, serverURL, submit])

  if (
    branch == null ||
    branch === '' ||
    collectionSlug == null ||
    collectionSlug === '' ||
    id == null
  ) {
    return <SaveButton />
  }

  return (
    <Button
      buttonStyle="primary"
      disabled={!modified}
      onClick={handleSave}
      size="medium"
      type="button"
    >
      Save
    </Button>
  )
}
