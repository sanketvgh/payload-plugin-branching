import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { buildConfig } from 'payload'

import { payloadPluginBranching } from '../../src/index.js'

const fixtureRootValue = process.env['PAYLOAD_BRANCHING_TEST_ROOT']

if (!fixtureRootValue) {
  throw new Error('PAYLOAD_BRANCHING_TEST_ROOT must identify a disposable test directory')
}

const fixtureRoot = path.resolve(fixtureRootValue)
const devDatabase = path.resolve(process.cwd(), 'dev', 'payload.db')
const fixtureDatabase = path.resolve(fixtureRoot, 'payload.db')

if (
  fixtureDatabase === devDatabase ||
  !path.basename(fixtureRoot).startsWith('payload-branching-')
) {
  throw new Error('Refusing to use a non-disposable Payload test database path')
}

export default buildConfig({
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [
        {
          name: 'role',
          type: 'select',
          defaultValue: 'editor',
          options: ['admin', 'editor'],
          required: true,
        },
      ],
    },
    {
      slug: 'posts',
      fields: [
        {
          name: 'title',
          type: 'text',
          hooks: {
            beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
          },
          required: true,
        },
        {
          name: 'secret',
          type: 'text',
          access: {
            read: ({ req }) => req.user?.collection === 'users' && req.user['role'] === 'admin',
          },
        },
        {
          name: 'settings',
          type: 'group',
          fields: [
            { name: 'label', type: 'text' },
            { name: 'tags', type: 'array', fields: [{ name: 'value', type: 'text' }] },
          ],
        },
      ],
      versions: {
        drafts: {
          autosave: true,
        },
      },
    },
    {
      slug: 'articles',
      fields: [
        {
          name: 'id',
          type: 'text',
          required: true,
        },
        {
          name: 'title',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      slug: 'media',
      fields: [],
      upload: {
        staticDir: path.resolve(fixtureRoot, 'media'),
      },
    },
  ],
  db: sqliteAdapter({
    client: {
      url: `file:${fixtureDatabase}`,
    },
    push: true,
  }),
  editor: lexicalEditor(),
  plugins: [payloadPluginBranching({ collections: { posts: true } })],
  secret: 'isolated-payload-branching-test-secret',
  typescript: {
    outputFile: path.resolve(fixtureRoot, 'payload-types.ts'),
  },
})
