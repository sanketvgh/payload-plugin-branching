import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { payloadPluginBranching } from 'payload-plugin-branching'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env['ROOT_DIR']) {
  process.env['ROOT_DIR'] = dirname
}

const buildConfigForDev = async () => {
  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections: [
      {
        slug: 'posts',
        fields: [
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'content',
            type: 'richText',
          },
          {
            name: 'summary',
            type: 'textarea',
          },
          {
            name: 'contactEmail',
            type: 'email',
          },
          {
            name: 'viewCount',
            type: 'number',
          },
          {
            name: 'publishAt',
            type: 'date',
          },
          {
            name: 'featured',
            type: 'checkbox',
          },
          {
            name: 'category',
            type: 'select',
            options: ['news', 'tutorial', 'opinion', 'announcement'],
          },
          {
            name: 'tags',
            type: 'select',
            hasMany: true,
            options: ['payload', 'react', 'nextjs', 'typescript', 'branching'],
          },
          {
            name: 'priority',
            type: 'radio',
            options: ['low', 'medium', 'high'],
          },
          {
            name: 'heroImage',
            type: 'upload',
            relationTo: 'media',
          },
          {
            name: 'relatedMedia',
            type: 'relationship',
            relationTo: 'media',
          },
          {
            name: 'gallery',
            type: 'relationship',
            hasMany: true,
            relationTo: 'media',
          },
          {
            name: 'snippet',
            type: 'code',
            admin: {
              language: 'typescript',
            },
          },
          {
            name: 'metadata',
            type: 'json',
          },
          {
            name: 'location',
            type: 'point',
          },
          {
            name: 'links',
            type: 'array',
            fields: [
              {
                name: 'label',
                type: 'text',
              },
              {
                name: 'url',
                type: 'text',
              },
              {
                name: 'external',
                type: 'checkbox',
              },
            ],
          },
          {
            name: 'author',
            type: 'group',
            fields: [
              {
                name: 'name',
                type: 'text',
              },
              {
                name: 'bio',
                type: 'textarea',
              },
              {
                name: 'avatar',
                type: 'upload',
                relationTo: 'media',
              },
            ],
          },
          {
            name: 'layout',
            type: 'blocks',
            blocks: [
              {
                slug: 'quote',
                fields: [
                  {
                    name: 'text',
                    type: 'textarea',
                  },
                  {
                    name: 'attribution',
                    type: 'text',
                  },
                ],
              },
              {
                slug: 'callout',
                fields: [
                  {
                    name: 'heading',
                    type: 'text',
                  },
                  {
                    name: 'body',
                    type: 'textarea',
                  },
                  {
                    name: 'tone',
                    type: 'select',
                    options: ['info', 'warning', 'success'],
                  },
                ],
              },
            ],
          },
          {
            type: 'row',
            fields: [
              {
                name: 'startDate',
                type: 'date',
              },
              {
                name: 'endDate',
                type: 'date',
              },
            ],
          },
          {
            type: 'tabs',
            tabs: [
              {
                fields: [
                  {
                    name: 'seoTitle',
                    type: 'text',
                  },
                  {
                    name: 'seoDescription',
                    type: 'textarea',
                  },
                ],
                label: 'SEO',
              },
              {
                fields: [
                  {
                    name: 'socialImage',
                    type: 'upload',
                    relationTo: 'media',
                  },
                  {
                    name: 'socialTitle',
                    type: 'text',
                  },
                ],
                label: 'Social',
              },
            ],
          },
          {
            type: 'collapsible',
            fields: [
              {
                name: 'internalNotes',
                type: 'textarea',
              },
            ],
            label: 'Advanced',
          },
        ],
        versions: true,
      },
      {
        slug: 'media',
        fields: [],
        upload: {
          staticDir: path.resolve(dirname, 'media'),
        },
      },
    ],
    db: sqliteAdapter({
      client: {
        url: process.env['DATABASE_URL'] || `file:${path.resolve(dirname, 'payload.db')}`,
      },
      migrationDir: path.resolve(dirname, 'migrations'),
      push: false,
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [payloadPluginBranching({ collections: { posts: true } })],
    secret: process.env['PAYLOAD_SECRET'] || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigForDev()
