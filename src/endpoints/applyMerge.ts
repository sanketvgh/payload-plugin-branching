import type { Endpoint } from 'payload'

import { projectBranchSummary } from '../branches/projection.js'
import { validateEnabledCollection } from '../contracts/collection.js'
import { parseCollectionDocumentID } from '../contracts/documentID.js'
import { parseApplyMergeInput } from '../contracts/merge.js'
import {
  applyMerge,
  InvalidPickError,
  MissingPicksError,
  OperationConflictError,
  StaleMergeError,
} from '../operations/applyMerge.js'

import { endpointErrorResponse, simpleErrorResponse } from './errorResponse.js'

export const applyMergeEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return simpleErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const input = parseApplyMergeInput(await req.json?.())

    if (!input.success) {
      const message =
        input.status === 428
          ? 'A previewToken and complete revision from a fresh preview are required'
          : 'Invalid merge request'

      return Response.json(
        { code: 'INVALID_REQUEST', error: message, errors: input.issues },
        { status: input.status },
      )
    }

    const enabled = validateEnabledCollection(req.payload, input.data.collectionSlug)

    if (!enabled.success) {
      return Response.json({ code: 'INVALID_COLLECTION', error: enabled.message }, { status: 400 })
    }

    const parsedID = parseCollectionDocumentID(
      req.payload,
      input.data.collectionSlug,
      input.data.parentId,
    )

    if (!parsedID.success) {
      return Response.json(
        { code: 'INVALID_DOCUMENT_ID', error: parsedID.message },
        { status: 400 },
      )
    }

    try {
      const result = await applyMerge({
        branch: input.data.branch,
        collectionSlug: input.data.collectionSlug,
        ...(input.data.operationId === undefined ? {} : { operationId: input.data.operationId }),
        parentId: parsedID.id,
        picks: input.data.picks,
        previewToken: input.data.previewToken,
        req,
        revision: input.data.revision,
      })

      return Response.json(
        { branch: projectBranchSummary(result.branch), doc: result.doc, replayed: result.replayed },
        { headers: { 'Cache-Control': 'private, no-store' }, status: 200 },
      )
    } catch (error) {
      if (error instanceof MissingPicksError) {
        return Response.json(
          {
            code: 'MISSING_PICKS',
            error: error.message,
            errors: [{ message: error.message }],
            missingFields: error.missingFields,
          },
          { status: 422 },
        )
      }

      if (error instanceof InvalidPickError)
        return Response.json(
          {
            code: 'INVALID_PICK',
            error: error.message,
            errors: [{ message: error.message }],
            invalidKeys: error.keys,
          },
          { status: 422 },
        )
      if (error instanceof StaleMergeError)
        return simpleErrorResponse(error.message, 409, 'STALE_MERGE')
      if (error instanceof OperationConflictError)
        return simpleErrorResponse(error.message, 409, 'OPERATION_CONFLICT')

      return endpointErrorResponse(error, req.payload.logger, 'Failed to apply merge')
    }
  },
  method: 'post',
  path: '/payload-plugin-branching/branches/merge-apply',
}
