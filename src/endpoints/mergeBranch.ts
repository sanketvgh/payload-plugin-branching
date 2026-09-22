import type { Endpoint } from 'payload'

import { parseBranchIdentityFromURL } from '../contracts/http.js'
import { mergeBranch } from '../operations/mergeBranch.js'

import { endpointErrorResponse, simpleErrorResponse } from './errorResponse.js'

export const mergeBranchPreviewEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return simpleErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const url = new URL(req.url ?? '', 'http://localhost')
    const input = parseBranchIdentityFromURL(req.payload, url)

    if (!input.success) return simpleErrorResponse(input.message, 400, 'INVALID_REQUEST')

    try {
      const result = await mergeBranch({
        branch: input.data.branch,
        collectionSlug: input.data.collectionSlug,
        parentId: input.data.parentId,
        payload: req.payload,
        req,
      })

      return Response.json(result.preview, {
        headers: { 'Cache-Control': 'private, no-store' },
        status: 200,
      })
    } catch (error) {
      return endpointErrorResponse(error, req.payload.logger, 'Failed to compute merge preview')
    }
  },
  method: 'get',
  path: '/payload-plugin-branching/branches/merge-preview',
}
