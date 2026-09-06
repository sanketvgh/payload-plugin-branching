import type { PayloadRequest } from 'payload'

import { isNumber, parseCookies } from 'payload/shared'

export const branchCookieName = 'payload-branch'

// Mirrors Payload's own `?locale=`/`?draft=` query param convention
// (see packages/payload/src/utilities/createPayloadRequest.ts) so a
// decoupled frontend, mobile app, or any non-browser client can select a
// branch explicitly on each request without relying on cookies, which
// require same-origin (or CORS credentials + SameSite=None; Secure) and
// don't exist at all for non-browser clients.
export const branchQueryParamName = 'payload-branch'

interface Args {
  idType: 'number' | 'text'
  req: PayloadRequest
}

// Query param takes precedence over the cookie: it's the explicit,
// per-request signal a decoupled client sends, whereas the cookie is an
// ambient default (used by the admin panel and same-origin frontends).
export function getActiveBranch({ idType, req }: Args): null | number | string {
  const fromQuery = req.searchParams.get(branchQueryParamName)
  const fromCookie = fromQuery ? null : (parseCookies(req.headers).get(branchCookieName) ?? null)
  const selectedBranch = fromQuery ?? fromCookie

  return selectedBranch
    ? idType === 'number' && isNumber(selectedBranch)
      ? parseFloat(selectedBranch)
      : selectedBranch
    : null
}
