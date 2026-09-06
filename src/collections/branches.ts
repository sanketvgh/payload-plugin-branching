import type { CollectionAfterChangeHook, CollectionConfig, PayloadRequest } from 'payload'

import { APIError } from 'payload'

import { generateBranchCookie } from '../utilities/generateBranchCookie.js'

interface Args {
  slug: string
}

interface BranchDoc {
  ancestorIds?: (number | string)[] | null
  id: number | string
  parentBranch?: { id: number | string } | null | number | string
}

export const branches = ({ slug }: Args): CollectionConfig => ({
  slug,
  admin: {
    useAsTitle: 'name',
  },
  endpoints: [
    {
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          throw new APIError(
            'You must be logged in to switch the active branch.',
            401,
            undefined,
            true,
          )
        }

        const body = (await req.json?.().catch(() => null)) as { id?: null | string } | null

        if (body === null || !('id' in body)) {
          throw new APIError(
            'Expected a JSON body with an "id" field (a branch id, or null to clear the active branch).',
            400,
            undefined,
            true,
          )
        }

        const { id } = body

        if (id) {
          const branch = await req.payload
            .findByID({ id, collection: slug, depth: 0, req })
            .catch(() => null)

          if (!branch) {
            throw new APIError(
              `No branch exists with id "${id}". It may have been deleted; refresh the branch list and try again.`,
              404,
              undefined,
              true,
            )
          }
        }

        const headers = new Headers()

        headers.set(
          'Set-Cookie',
          id
            ? generateBranchCookie({ value: id })
            : generateBranchCookie({ expires: new Date(0), value: '' }),
        )

        return Response.json({ message: 'Active branch updated' }, { headers, status: 200 })
      },
      method: 'post',
      path: '/switch-active-branch',
    },
  ],
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'parentBranch',
      type: 'relationship',
      relationTo: slug,
    },
    {
      name: 'ancestorIds',
      type: 'relationship',
      admin: {
        hidden: true,
      },
      hasMany: true,
      relationTo: slug,
    },
  ],
  hooks: {
    afterChange: [
      (async ({ doc, operation, req }) => {
        if (operation !== 'create' || !doc.parentBranch) {
          return
        }

        const parentId =
          typeof doc.parentBranch === 'object' ? doc.parentBranch.id : doc.parentBranch

        // Nearest-first, mirroring the ordering pickBestBranchMatch ranks
        // by: the parent itself, then whatever the parent already resolved
        // as its own ancestors. Computed once here (branches are rarely
        // created, this cost is paid once, not on every document read).
        const parent = (await req.payload.findByID({
          id: parentId,
          collection: slug,
          depth: 0,
          req,
        })) as BranchDoc

        const ancestorIds = [parentId, ...(parent.ancestorIds ?? [])]

        await req.payload.update({
          id: doc.id,
          collection: slug,
          data: { ancestorIds },
          req,
        })
      }) satisfies CollectionAfterChangeHook<BranchDoc>,
    ],
  },
})
