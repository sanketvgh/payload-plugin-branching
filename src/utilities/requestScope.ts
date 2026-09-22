import type { PayloadRequest, RequestContext } from 'payload'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'

export const deriveRequest = async (
  source: PayloadRequest,
  context: RequestContext = {},
): Promise<PayloadRequest> => {
  const seed: Partial<PayloadRequest> = {
    headers: source.headers,
    i18n: source.i18n,
    payloadAPI: source.payloadAPI,
    user: source.user,
  }

  if (source.fallbackLocale !== undefined) seed.fallbackLocale = source.fallbackLocale
  if (source.locale !== undefined) seed.locale = source.locale

  const derived = await createLocalReq(
    { context, req: seed, urlSuffix: source.pathname },
    source.payload,
  )

  const transactionID = await source.transactionID

  if (transactionID !== undefined) derived.transactionID = transactionID

  return derived
}

export const withTransaction = async <T>(
  req: PayloadRequest,
  operation: (scopedReq: PayloadRequest) => Promise<T>,
): Promise<T> => {
  const scopedReq = await deriveRequest(req)
  const owns = await initTransaction(scopedReq)

  try {
    const value = await operation(scopedReq)

    if (owns) await commitTransaction(scopedReq)

    return value
  } catch (error) {
    if (owns) await killTransaction(scopedReq)
    throw error
  }
}
