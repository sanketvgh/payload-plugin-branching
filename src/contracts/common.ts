import { z } from 'zod'

export const nonEmptyStringSchema = z.string().trim().min(1)

export const transportIDSchema = z.union([z.string().min(1), z.number().int().positive()])

export const documentDataSchema = z.record(z.string(), z.unknown())

export type DocumentData = z.infer<typeof documentDataSchema>

export interface ContractFailure {
  issues: z.core.$ZodIssue[]
  status: 400 | 428
  success: false
}

export interface ContractSuccess<T> {
  data: T
  success: true
}

export type ContractResult<T> = ContractFailure | ContractSuccess<T>
