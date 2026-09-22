import type { Endpoint } from 'payload'
import { addDataAndFileToRequest } from 'payload'
import { z } from 'zod'

import { projectBranchSummary, projectResolvedBranchDocument } from '../branches/projection.js'
import { saveBranchInputSchema } from '../contracts/branches.js'
import { validateEnabledCollection } from '../contracts/collection.js'
import { documentDataSchema, transportIDSchema } from '../contracts/common.js'
import { parseCollectionDocumentID } from '../contracts/documentID.js'
import { saveBranch } from '../operations/saveBranch.js'

import { endpointErrorResponse, simpleErrorResponse } from './errorResponse.js'

const partialSaveEnvelopeSchema = z.strictObject({
  branch: z.string().optional(),
  collectionSlug: z.string().optional(),
  data: documentDataSchema.optional(),
  expectedRevision: z.union([z.number(), z.string()]).optional(),
  parentId: transportIDSchema.optional(),
})

const queryValue = (url: URL, name: string): string | undefined =>
  url.searchParams.get(name) ?? undefined

type EndpointRequest = Parameters<NonNullable<Endpoint['handler']>>[0]
type ParsedSaveRequest =
  | { data: z.infer<typeof saveBranchInputSchema>; success: true }
  | { message: string; status: 400 | 428; success: false }

const invalid = (message: string, status: 400 | 428 = 400): ParsedSaveRequest => ({
  message,
  status,
  success: false,
})

const parseSaveRequest = async (req: EndpointRequest): Promise<ParsedSaveRequest> => {
  const contentType = req.headers.get('content-type') ?? ''
  const isMultipart = contentType.includes('multipart/')

  try {
    await addDataAndFileToRequest(req)
  } catch {
    return invalid('Invalid request body')
  }

  if (req.file != null || (req.files != null && Object.keys(req.files).length > 0)) {
    return invalid('Files are not supported in branch saves')
  }

  let payloadInput: z.infer<typeof partialSaveEnvelopeSchema>

  if (isMultipart) {
    const document = documentDataSchema.safeParse(req.data)

    if (!document.success) return invalid('Invalid branch document')
    payloadInput = { data: document.data }
  } else {
    const envelope = partialSaveEnvelopeSchema.safeParse(req.data)

    if (!envelope.success) return invalid('Invalid branch save request')

    payloadInput = envelope.data
  }

  return mergeIdentity(new URL(req.url ?? '', 'http://localhost'), payloadInput)
}

const mergeIdentity = (
  url: URL,
  payloadInput: z.infer<typeof partialSaveEnvelopeSchema>,
): ParsedSaveRequest => {
  const input = saveBranchInputSchema.safeParse({
    branch: queryValue(url, 'branch') ?? payloadInput.branch,
    collectionSlug: queryValue(url, 'collectionSlug') ?? payloadInput.collectionSlug,
    data: payloadInput.data,
    expectedRevision: queryValue(url, 'expectedRevision') ?? payloadInput.expectedRevision,
    parentId: queryValue(url, 'parentId') ?? payloadInput.parentId,
  })

  if (input.success) return { data: input.data, success: true }

  const revisionMissing = input.error.issues.some(
    (issue) => issue.path[0] === 'expectedRevision' && issue.code === 'invalid_type',
  )

  return revisionMissing
    ? invalid('expectedRevision from the loaded branch is required', 428)
    : invalid('Invalid branch save request')
}

export const saveBranchEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) return simpleErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')

    const input = await parseSaveRequest(req)

    if (!input.success) {
      return simpleErrorResponse(
        input.message,
        input.status,
        input.status === 428 ? 'REVISION_REQUIRED' : 'INVALID_REQUEST',
      )
    }

    const enabled = validateEnabledCollection(req.payload, input.data.collectionSlug)

    if (!enabled.success) return simpleErrorResponse(enabled.message, 400, 'INVALID_COLLECTION')

    const parsedID = parseCollectionDocumentID(
      req.payload,
      input.data.collectionSlug,
      input.data.parentId,
    )

    if (!parsedID.success) return simpleErrorResponse(parsedID.message, 400, 'INVALID_DOCUMENT_ID')

    try {
      const result = await saveBranch({
        branch: input.data.branch,
        collectionSlug: input.data.collectionSlug,
        data: input.data.data,
        expectedRevision: input.data.expectedRevision,
        parentId: parsedID.id,
        req,
      })

      const collection = req.payload.collections[input.data.collectionSlug]?.config

      if (!collection) throw new Error(`Unknown collection "${input.data.collectionSlug}"`)

      const resolvedDoc = await projectResolvedBranchDocument({
        branchRow: result.branch,
        collection,
        parentId: parsedID.id,
        req,
      })

      return Response.json(
        {
          branch: projectBranchSummary(result.branch),
          doc: { ...result.parentMetadata, ...resolvedDoc },
          message: `Changes saved to "${input.data.branch}"`,
          resolvedDoc,
        },
        { headers: { 'Cache-Control': 'private, no-store' }, status: 200 },
      )
    } catch (error) {
      return endpointErrorResponse(error, req.payload.logger, 'Could not save these changes')
    }
  },
  method: 'post',
  path: '/payload-plugin-branching/branches/save',
}
