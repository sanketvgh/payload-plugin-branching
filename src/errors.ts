import { APIError } from 'payload'

export class BranchingAPIError extends APIError<Record<string, unknown>> {
  readonly code: string

  constructor(message: string, status: number, code: string, data: Record<string, unknown> = {}) {
    super(message, status, data, true)
    this.code = code
  }
}
