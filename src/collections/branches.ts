import type { CollectionConfig, PayloadRequest } from 'payload'

interface Args {
  closureSlug: string
  slug: string
}

interface BranchDoc {
  id: number | string
  parentBranch?: { id: number | string } | null | number | string
}

interface ClosureRow {
  ancestor: { id: number | string } | number | string
  depth: number
}

export const branches = ({ slug, closureSlug }: Args): CollectionConfig => ({
  slug,
  admin: {
    useAsTitle: 'name',
  },
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
  ],
  hooks: {
    afterChange: [
      async ({
        doc,
        operation,
        req,
      }: {
        doc: BranchDoc
        operation: string
        req: PayloadRequest
      }) => {
        if (operation !== 'create') {
          return
        }

        const rows: { ancestor: number | string; depth: number }[] = [
          { ancestor: doc.id, depth: 0 },
        ]

        if (doc.parentBranch) {
          const parentId =
            typeof doc.parentBranch === 'object' ? doc.parentBranch.id : doc.parentBranch

          const parentAncestry = await req.payload.find({
            collection: closureSlug,
            limit: 0,
            req,
            where: {
              descendant: { equals: parentId },
            },
          })

          for (const row of parentAncestry.docs as unknown as ClosureRow[]) {
            const ancestorId = typeof row.ancestor === 'object' ? row.ancestor.id : row.ancestor
            rows.push({ ancestor: ancestorId, depth: row.depth + 1 })
          }
        }

        for (const row of rows) {
          await req.payload.create({
            collection: closureSlug,
            data: {
              ancestor: row.ancestor,
              depth: row.depth,
              descendant: doc.id,
            },
            req,
          })
        }
      },
    ],
    beforeDelete: [
      async ({ id, req }: { id: number | string; req: PayloadRequest }) => {
        await req.payload.delete({
          collection: closureSlug,
          req,
          where: {
            or: [{ ancestor: { equals: id } }, { descendant: { equals: id } }],
          },
        })
      },
    ],
  },
})
