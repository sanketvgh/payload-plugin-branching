'use client'

import { Button, Form, FormSubmit, TextField, useConfig } from '@payloadcms/ui'
import type { FormState } from 'payload'
import { formatAdminURL } from 'payload/shared'
import type { FC } from 'react'

import { branchSummarySchema } from '../../contracts/branches.js'
import type { BranchRow } from '../BranchSwitcher/useBranches.js'

interface CreateBranchFormProps {
  baseClass: string
  collectionSlug: string
  existingNames: string[]
  idPrefix: string
  onCancel: () => void
  onCreated: (branch: BranchRow) => void
  parentId: number | string
}

export const CreateBranchForm: FC<CreateBranchFormProps> = ({
  baseClass,
  collectionSlug,
  existingNames,
  idPrefix,
  onCancel,
  onCreated,
  parentId,
}) => {
  const {
    config: {
      routes: { api: apiRoute },
      serverURL,
    },
  } = useConfig()

  const action = formatAdminURL({ apiRoute, path: '/payload-plugin-branching/branches', serverURL })

  const initialState: FormState = {
    branchName: { initialValue: '', valid: true, value: '' },
    collectionSlug: { initialValue: collectionSlug, valid: true, value: collectionSlug },
    parentId: { initialValue: parentId, valid: true, value: parentId },
  }

  return (
    <Form
      disableSuccessStatus
      action={action}
      className={`${baseClass}__wrapper`}
      initialState={initialState}
      method="POST"
      onSuccess={(json) => {
        const branch = branchSummarySchema.safeParse(json)

        if (branch.success) onCreated(branch.data)
      }}
    >
      <div className={`${baseClass}__content`}>
        <h1 id={`${idPrefix}-heading`}>Create a branch</h1>
        <p id={`${idPrefix}-description`}>
          This branch starts from the current content on main. Changes you make here stay separate
          until you merge the branch back into main.
        </p>
        <TextField
          path="branchName"
          field={{
            name: 'branchName',
            admin: { autoComplete: 'off', placeholder: 'summer-campaign' },
            label: 'Branch name',
            required: true,
          }}
          validate={(value) => {
            const name = typeof value === 'string' ? value.trim() : ''

            if (name === '') {
              return 'Branch name is required.'
            }

            if (existingNames.includes(name)) {
              return `A branch named "${name}" already exists.`
            }

            return true
          }}
        />
      </div>
      <div className={`${baseClass}__controls`}>
        <Button buttonStyle="secondary" onClick={onCancel} size="large" type="button">
          Cancel
        </Button>
        <FormSubmit size="large">Create branch</FormSubmit>
      </div>
    </Form>
  )
}
