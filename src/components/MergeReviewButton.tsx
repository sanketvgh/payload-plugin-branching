'use client'

import { Button, useDocumentInfo } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation.js'
import type { FC } from 'react'

export const MergeReviewButton: FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const params = useSearchParams()
  const branch = params.get('branch')

  if (
    id == null ||
    collectionSlug == null ||
    collectionSlug === '' ||
    branch == null ||
    branch === ''
  ) {
    return null
  }

  const href = `/admin/collections/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(String(id))}/branch-merge/${encodeURIComponent(branch)}`

  return (
    <Button buttonStyle="primary" el="anchor" size="medium" url={href}>
      Merge {branch} into main
    </Button>
  )
}
