import type { Endpoint } from 'payload'

import { projectBranchSummary, projectResolvedBranchDocument } from '../branches/projection.js'
import { parseBranchIdentityFromURL } from '../contracts/http.js'
import { resolveBranch } from '../operations/resolveBranch.js'

import { endpointErrorResponse, simpleErrorResponse } from './errorResponse.js'

export const resolveBranchEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return simpleErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const url = new URL(req.url ?? '', 'http://localhost')
    const input = parseBranchIdentityFromURL(req.payload, url)

    if (!input.success) return simpleErrorResponse(input.message, 400, 'INVALID_REQUEST')

    try {
      const result = await resolveBranch({
        branch: input.data.branch,
        collectionSlug: input.data.collectionSlug,
        parentId: input.data.parentId,
        payload: req.payload,
        req,
      })

      const collection = req.payload.collections[input.data.collectionSlug]?.config

      if (!collection) throw new Error(`Unknown collection "${input.data.collectionSlug}"`)

      const resolvedDoc = await projectResolvedBranchDocument({
        branchRow: result.branchDoc,
        collection,
        parentId: input.data.parentId,
        req,
      })

      return Response.json(
        { branch: projectBranchSummary(result.branchDoc), resolvedDoc },
        { headers: { 'Cache-Control': 'private, no-store' }, status: 200 },
      )
    } catch (error) {
      return endpointErrorResponse(error, req.payload.logger, 'Failed to resolve branch')
    }
  },
  method: 'get',
  path: '/payload-plugin-branching/branches/resolve',
}
