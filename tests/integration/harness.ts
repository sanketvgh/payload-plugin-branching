import type { Payload, PayloadRequest } from 'payload'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createLocalReq, getPayload } from 'payload'

export interface Fixture {
  payload: Payload
  root: string
}

export const bootFixture = async (): Promise<Fixture> => {
  const root = await mkdtemp(path.join(tmpdir(), 'payload-branching-'))

  process.env['PAYLOAD_BRANCHING_TEST_ROOT'] = root

  const config = await import('../fixtures/payload.config.js')
  const payload = await getPayload({ config: config.default })

  return { payload, root }
}

export const teardownFixture = async (fixture: Fixture | undefined): Promise<void> => {
  if (!fixture) return

  const databaseClient = Reflect.get(fixture.payload.db, 'client')
  const close =
    typeof databaseClient === 'object' && databaseClient !== null
      ? Reflect.get(databaseClient, 'close')
      : undefined

  if (typeof close === 'function') Reflect.apply(close, databaseClient, [])

  await fixture.payload.destroy()
  delete process.env['PAYLOAD_BRANCHING_TEST_ROOT']

  const resolvedRoot = path.resolve(fixture.root)

  if (
    path.dirname(resolvedRoot) !== path.resolve(tmpdir()) ||
    !path.basename(resolvedRoot).startsWith('payload-branching-')
  ) {
    throw new Error('Refusing to clean a path outside the disposable test directory')
  }

  await rm(resolvedRoot, { force: true, maxRetries: 10, recursive: true, retryDelay: 100 })
}

export const editorRequest = async (
  payload: Payload,
  email: string,
  role: 'admin' | 'editor' = 'editor',
): Promise<PayloadRequest> => {
  const password = 'fixture-password'

  await payload.create({ collection: 'users', data: { email, password, role } })

  const login = await payload.login({ collection: 'users', data: { email, password } })

  if (!login.user) throw new Error('Fixture login did not return a user')

  return createLocalReq({ user: { ...login.user, collection: 'users' } }, payload)
}
