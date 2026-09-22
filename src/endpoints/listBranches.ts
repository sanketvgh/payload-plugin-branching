import type { Endpoint } from 'payload'

import { projectBranchSummary } from '../branches/projection.js'
import { branchesSlug } from '../collections/createBranchesCollection.js'
import { listBranchesInputSchema } from '../contracts/branches.js'
import { validateEnabledCollection } from '../contracts/collection.js'
import { parseCollectionDocumentID } from '../contracts/documentID.js'
import { branchRequest } from '../utilities/branchAccess.js'

import { endpointErrorResponse, simpleErrorResponse } from './errorResponse.js'

export const listBranchesEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) return simpleErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')

    const url = new URL(req.url ?? '', 'http://localhost')

    const input = listBranchesInputSchema.safeParse({
      collectionSlug: url.searchParams.get('collectionSlug'),
      limit: Number(url.searchParams.get('limit') ?? 100),
      page: Number(url.searchParams.get('page') ?? 1),
      parentId: url.searchParams.get('parentId'),
    })

    if (!input.success)
      return simpleErrorResponse('collectionSlug and parentId are required', 400, 'INVALID_REQUEST')
    const enabled = validateEnabledCollection(req.payload, input.data.collectionSlug)

    if (!enabled.success) return simpleErrorResponse(enabled.message, 400, 'INVALID_COLLECTION')

    const parsedID = parseCollectionDocumentID(
      req.payload,
      input.data.collectionSlug,
      input.data.parentId,
    )

    if (!parsedID.success) return simpleErrorResponse(parsedID.message, 400, 'INVALID_DOCUMENT_ID')

    try {
      await req.payload.findByID({
        id: parsedID.id,
        collection: input.data.collectionSlug,
        overrideAccess: false,
        req,
      })

      const result = await req.payload.find({
        collection: branchesSlug(input.data.collectionSlug),
        limit: input.data.limit,
        overrideAccess: false,
        page: input.data.page,
        req: await branchRequest(req),
        sort: 'branch',
        where: { parent: { equals: parsedID.id } },
      })

      return Response.json(
        {
          docs: result.docs.map((doc) => projectBranchSummary(doc)),
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
          limit: result.limit,
          nextPage: result.nextPage,
          page: result.page,
          prevPage: result.prevPage,
          totalDocs: result.totalDocs,
          totalPages: result.totalPages,
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    } catch (error) {
      return endpointErrorResponse(error, req.payload.logger, 'Could not list branches')
    }
  },
  method: 'get',
  path: '/payload-plugin-branching/branches/list',
}
