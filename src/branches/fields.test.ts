import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { branchableFields } from './fields.js'

describe('branchable field policy', () => {
  it('uses Payload top-level flattening for layouts and named tabs', () => {
    const fields: Field[] = [
      {
        type: 'row',
        fields: [{ name: 'rowTitle', type: 'text' }],
      },
      {
        type: 'tabs',
        tabs: [
          { fields: [{ name: 'plainTabTitle', type: 'text' }], label: 'Plain' },
          { name: 'settings', fields: [{ name: 'nested', type: 'text' }], label: 'Named' },
        ],
      },
      { name: 'group', type: 'group', fields: [{ name: 'child', type: 'text' }] },
      { name: 'items', type: 'array', fields: [{ name: 'value', type: 'text' }] },
      { name: 'virtualValue', type: 'text', virtual: true },
      { name: 'createdAt', type: 'date' },
      { name: 'presentation', type: 'ui', admin: { components: { Field: 'Example' } } },
    ]

    expect(
      branchableFields(fields).map((field) => ('name' in field ? field.name : undefined)),
    ).toEqual(['rowTitle', 'plainTabTitle', 'settings', 'group', 'items'])
  })
})
