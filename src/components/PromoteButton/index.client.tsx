'use client'

import { Button, ConfirmationModal, toast, useModal } from '@payloadcms/ui'
import { useRouter } from 'next/navigation.js'
import React from 'react'

interface Props {
  branchName: string
  collectionSlug: string
  id: number | string
}

export const PromoteButton = ({ id, branchName, collectionSlug }: Props) => {
  const router = useRouter()
  const { closeModal, openModal } = useModal()
  const [isPending, setIsPending] = React.useState(false)
  const modalSlug = `promote-to-default-${collectionSlug}-${String(id)}`

  const onConfirm = async () => {
    setIsPending(true)

    try {
      const res = await fetch(`/api/${collectionSlug}/${String(id)}/promote-to-default`, {
        credentials: 'include',
        method: 'POST',
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { errors?: { message: string }[] } | null
        toast.error(body?.errors?.[0]?.message ?? 'Failed to promote to Default.')
        return
      }

      toast.success('Promoted this document to Default.')
      router.refresh()
    } finally {
      setIsPending(false)
      closeModal(modalSlug)
    }
  }

  return (
    <React.Fragment>
      <Button
        buttonStyle="secondary"
        disabled={isPending}
        onClick={() => {
          openModal(modalSlug)
        }}
        size="small"
      >
        Promote this document…
      </Button>
      <ConfirmationModal
        body={`This copies this document's field values onto its Default-branch document. Only THIS document is affected — no other documents on the "${branchName}" branch will be promoted. This does not delete or change anything on "${branchName}" itself.`}
        cancelLabel="Cancel"
        confirmLabel="Promote this document"
        heading="Promote this document to Default?"
        modalSlug={modalSlug}
        onCancel={() => {
          closeModal(modalSlug)
        }}
        onConfirm={() => {
          void onConfirm()
        }}
      />
    </React.Fragment>
  )
}
