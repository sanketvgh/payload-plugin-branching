import type { Endpoint } from 'payload'
import { addDataAndFileToRequest } from 'payload'

import { projectBranchSummary } from '../branches/projection.js'
import { createBranchInputSchema } from '../contracts/branches.js'
import { validateEnabledCollection } from '../contracts/collection.js'
import { parseCollectionDocumentID } from '../contracts/documentID.js'
import { createBranch } from '../operations/createBranch.js'

import { endpointErrorResponse, simpleErrorResponse } from './errorResponse.js'

export const createBranchEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) return simpleErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')

    try {
      await addDataAndFileToRequest(req)
    } catch {
      return simpleErrorResponse('Invalid request body', 400, 'INVALID_REQUEST')
    }

    const input = createBranchInputSchema.safeParse(req.data)

    if (!input.success) return simpleErrorResponse('Invalid branch request', 400, 'INVALID_REQUEST')
    const enabled = validateEnabledCollection(req.payload, input.data.collectionSlug)

    if (!enabled.success) return simpleErrorResponse(enabled.message, 400, 'INVALID_COLLECTION')

    const parsedID = parseCollectionDocumentID(
      req.payload,
      input.data.collectionSlug,
      input.data.parentId,
    )

    if (!parsedID.success) return simpleErrorResponse(parsedID.message, 400, 'INVALID_DOCUMENT_ID')

    try {
      const created = await createBranch({
        branchName: input.data.branchName,
        collectionSlug: input.data.collectionSlug,
        ...(input.data.copyFrom !== undefined ? { copyFrom: input.data.copyFrom } : {}),
        createdBy: req.user.id,
        parentId: parsedID.id,
        payload: req.payload,
        req,
      })

      return Response.json(projectBranchSummary(created), {
        headers: { 'Cache-Control': 'private, no-store' },
        status: 201,
      })
    } catch (error) {
      return endpointErrorResponse(error, req.payload.logger, 'Failed to create branch')
    }
  },
  method: 'post',
  path: '/payload-plugin-branching/branches',
}
