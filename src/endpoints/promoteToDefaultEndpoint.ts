import type { CollectionSlug, Endpoint } from 'payload'

import { APIError } from 'payload'

import { promoteBranchDocument } from '../utilities/promoteBranchDocument.js'

interface Args {
  branchFieldName: string
  canonicalIdFieldName: string
  collectionSlug: CollectionSlug
}

// Mirrors Payload's own `POST /:id/duplicate` convention (see
// packages/payload/src/collections/endpoints/duplicate.ts) for a
// per-document custom action addressed by route param.
export const promoteToDefaultEndpoint = ({
  branchFieldName,
  canonicalIdFieldName,
  collectionSlug,
}: Args): Endpoint => ({
  handler: async (req) => {
    if (!req.user) {
      throw new APIError('You must be logged in to promote a document.', 401, undefined, true)
    }

    const id = req.routeParams?.id as number | string | undefined

    if (!id) {
      throw new APIError('Missing document id in the request path.', 400, undefined, true)
    }

    const doc = await promoteBranchDocument({
      id,
      branchFieldName,
      canonicalIdFieldName,
      collectionSlug,
      req,
    })

    return Response.json({ doc, message: 'Promoted to Default' }, { status: 200 })
  },
  method: 'post',
  path: '/:id/promote-to-default',
})
