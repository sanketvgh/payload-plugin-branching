import type { PayloadRequest, RequestContext } from 'payload'

import { deriveRequest } from './requestScope.js'

const INTERNAL_ACCESS = '__internalBranchAccess'

export const internalBranchAccessContext = (): RequestContext => ({ [INTERNAL_ACCESS]: true })

export const branchRequest = (req: PayloadRequest): Promise<PayloadRequest> =>
  deriveRequest(req, internalBranchAccessContext())

export const hasInternalBranchAccess = (req: unknown): boolean => {
  if (typeof req !== 'object' || req === null || !('context' in req)) return false
  const { context } = req

  if (typeof context !== 'object' || context === null || Array.isArray(context)) return false

  return INTERNAL_ACCESS in context && context[INTERNAL_ACCESS] === true
}
