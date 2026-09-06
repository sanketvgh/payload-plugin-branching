import type { TextField } from 'payload'

interface Args {
  name: string
}

export const canonicalIdField = ({ name }: Args): TextField => ({
  name,
  type: 'text',
  admin: {
    disableListColumn: true,
    disableListFilter: true,
    hidden: true,
    position: 'sidebar',
    readOnly: true,
  },
  index: true,
  required: false,
})
