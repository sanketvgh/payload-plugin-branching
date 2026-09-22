import type { Payload } from 'payload'
import { APIError, formatErrors, ValidationError } from 'payload'

import { BranchingAPIError } from '../errors.js'

export const endpointErrorResponse = (
  error: unknown,
  logger: Payload['logger'],
  fallbackMessage: string,
): Response => {
  if (error instanceof ValidationError) {
    return Response.json(formatErrors(error), { status: error.status })
  }

  if (error instanceof BranchingAPIError) {
    return Response.json(
      {
        code: error.code,
        error: error.message,
        errors: [{ message: error.message }],
        ...error.data,
      },
      { status: error.status },
    )
  }

  if (error instanceof APIError && error.isPublic) {
    return Response.json(
      { error: error.message, errors: [{ message: error.message }] },
      { status: error.status },
    )
  }

  logger.error(error)

  return Response.json(
    { error: fallbackMessage, errors: [{ message: fallbackMessage }] },
    { status: 500 },
  )
}

export const simpleErrorResponse = (message: string, status: number, code?: string): Response =>
  Response.json(
    {
      ...(code === undefined ? {} : { code }),
      error: message,
      errors: [{ message }],
    },
    { status },
  )
