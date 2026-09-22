'use client'

import { Modal, useModal } from '@payloadcms/ui'
import type { FC } from 'react'

import type { BranchRow } from '../BranchSwitcher/useBranches.js'

import { CreateBranchForm } from './CreateBranchForm.js'

const baseClass = 'create-branch-modal'

interface CreateBranchModalProps {
  collectionSlug: string
  existingNames: string[]
  onCreated: (branch: BranchRow) => void
  parentId: number | string
  slug: string
}

export const CreateBranchModal: FC<CreateBranchModalProps> = ({
  slug,
  collectionSlug,
  existingNames,
  onCreated,
  parentId,
}) => {
  const { closeModal } = useModal()

  return (
    <Modal
      aria-describedby={`${slug}-description`}
      aria-labelledby={`${slug}-heading`}
      className={baseClass}
      closeOnBlur={false}
      focusTrapOptions={{ initialFocus: '#field-branchName' }}
      slug={slug}
    >
      <CreateBranchForm
        baseClass={baseClass}
        collectionSlug={collectionSlug}
        existingNames={existingNames}
        idPrefix={slug}
        parentId={parentId}
        onCancel={() => {
          closeModal(slug)
        }}
        onCreated={(branch) => {
          closeModal(slug)
          onCreated(branch)
        }}
      />
    </Modal>
  )
}
