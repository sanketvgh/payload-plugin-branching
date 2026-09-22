'use client'

import '../index.scss'

import {
  ChevronIcon,
  Pill,
  Popup,
  toast,
  useDocumentInfo,
  useDrawerSlug,
  useModal,
  useRouteTransition,
} from '@payloadcms/ui'
import { useRouter, useSearchParams } from 'next/navigation.js'
import type { FC } from 'react'
import { Fragment, useEffect, useRef } from 'react'

import { CreateBranchModal } from '../CreateBranchModal/index.js'

import { BranchMenu } from './BranchMenu.js'
import { useBranches } from './useBranches.js'

const baseClass = 'branch-switcher'

export const BranchSwitcher: FC = () => {
  const { id, collectionSlug } = useDocumentInfo()

  const router = useRouter()
  const searchParams = useSearchParams()
  const { startRouteTransition } = useRouteTransition()
  const activeBranch = searchParams.get('branch') ?? ''
  const { isModalOpen, openModal } = useModal()
  const createModalSlug = useDrawerSlug('create-branch')
  const { branches, isError, refresh } = useBranches({ collectionSlug, parentId: id })

  const lastBranch = useRef(activeBranch)

  useEffect(() => {
    if (lastBranch.current === activeBranch) return

    lastBranch.current = activeBranch
    refresh()
  }, [activeBranch, refresh])

  if (id == null || collectionSlug == null || collectionSlug === '') {
    return null
  }

  const selectBranch = (branchName: string) => {
    if (branchName === activeBranch) {
      return
    }

    const params = new URLSearchParams(window.location.search)

    if (branchName !== '') {
      params.set('branch', branchName)
    } else {
      params.delete('branch')
    }

    const search = params.toString()

    startRouteTransition(() => {
      router.push(search !== '' ? `?${search}` : window.location.pathname)
    })
  }

  const isDiverged = branches?.some((row) => row.branch === activeBranch && row.diverged) ?? false

  return (
    <Fragment>
      <Popup
        showScrollbar
        className={baseClass}
        horizontalAlign="right"
        portalClassName={`${baseClass}__popup`}
        size="large"
        button={
          <Pill
            aria-label={`Branch: ${activeBranch === '' ? 'main' : activeBranch}`}
            className={`${baseClass}__pill`}
            icon={<ChevronIcon />}
            pillStyle={isDiverged ? 'warning' : 'light'}
          >
            {activeBranch === '' ? 'main' : activeBranch}
          </Pill>
        }
        onToggleOpen={(active) => {
          if (active) refresh()
        }}
        render={({ close }) => (
          <BranchMenu
            activeBranch={activeBranch}
            baseClass={baseClass}
            branches={branches}
            isError={isError}
            onRetry={refresh}
            onCreate={() => {
              close()
              openModal(createModalSlug)
            }}
            onSelect={(branchName) => {
              close()
              selectBranch(branchName)
            }}
          />
        )}
      />
      {isModalOpen(createModalSlug) && (
        <CreateBranchModal
          collectionSlug={collectionSlug}
          existingNames={(branches ?? []).map((row) => row.branch)}
          parentId={id}
          slug={createModalSlug}
          onCreated={(branch) => {
            refresh()
            toast.success(`Created branch "${branch.branch}"`)
            selectBranch(branch.branch)
          }}
        />
      )}
    </Fragment>
  )
}
