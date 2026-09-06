import type { ServerProps } from 'payload'

import { cookies } from 'next/headers.js'
import { isNumber, parseCookies } from 'payload/shared'

import { branchCookieName } from '../../utilities/getActiveBranch.js'
import { getCollectionIDType } from '../../utilities/getCollectionIDType.js'
import { BranchSelectorClient } from './index.client.js'

type Props = { branchesSlug: string } & ServerProps

export const BranchSelector = async ({ branchesSlug, payload }: Props) => {
  const idType = getCollectionIDType({ collectionSlug: branchesSlug, payload })
  const cookieStore = await cookies()
  // This slot has no PayloadRequest/URL to read a `?payload-branch=` query
  // param from (it renders once per admin page, not per-request), so it's
  // cookie-only. Cookies are the right transport here anyway: this is the
  // admin panel's own same-origin browser session.
  const headers = new Headers(cookieStore.toString() ? [['cookie', cookieStore.toString()]] : [])
  const cookieBranch = parseCookies(headers).get(branchCookieName) ?? null
  const activeBranch = cookieBranch
    ? idType === 'number' && isNumber(cookieBranch)
      ? parseFloat(cookieBranch)
      : cookieBranch
    : null

  const { docs: branches } = await payload.find({
    collection: branchesSlug,
    depth: 0,
    limit: 100,
  })

  return (
    <BranchSelectorClient
      activeBranchId={activeBranch !== null ? String(activeBranch) : null}
      branches={branches.map((branch) => ({
        id: String(branch.id),
        name: branch.name as string,
      }))}
    />
  )
}
