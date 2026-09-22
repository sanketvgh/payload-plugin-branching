import { describe, expect, it } from 'vitest'

import { projectBranchSummary } from './projection.js'

describe('projectBranchSummary', () => {
  it('projects a full stored branch row down to the summary contract', () => {
    const summary = projectBranchSummary({
      id: 1,
      baselineCapturedAt: '2026-09-20T00:00:00.000Z',
      baselineManifest: { title: { captured: true } },
      baselineRevision: 0,
      baselineSnapshot: { title: 'Main' },
      branch: 'feature-a',
      createdAt: '2026-09-20T00:00:00.000Z',
      overrides: {},
      parent: 1,
      updatedAt: '2026-09-20T00:00:00.000Z',
    })

    expect(summary).toEqual({ id: 1, branch: 'feature-a', diverged: false, revision: 0 })
  })

  it('rejects rows missing required identity', () => {
    expect(() => projectBranchSummary({ branch: 'feature-a' })).toThrow(
      'Stored branch metadata is invalid',
    )
  })
})
