import { isNumber, parseCookies } from 'payload/shared'

export const branchCookieName = 'payload-branch'

export function getBranchFromCookie(
  headers: Headers,
  idType: 'number' | 'text',
): null | number | string {
  const cookies = parseCookies(headers)
  const selectedBranch = cookies.get(branchCookieName) ?? null
  return selectedBranch
    ? idType === 'number' && isNumber(selectedBranch)
      ? parseFloat(selectedBranch)
      : selectedBranch
    : null
}
