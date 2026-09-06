import { generateCookie } from 'payload/shared'

import { branchCookieName } from './getBranchFromCookie.js'

interface Args {
  expires?: Date
  value: string
}

export const generateBranchCookie = ({ expires, value }: Args): string =>
  generateCookie<false>({
    name: branchCookieName,
    ...(expires ? { expires } : {}),
    httpOnly: true,
    path: '/',
    returnCookieAsObject: false,
    sameSite: 'Lax',
    value,
  })
