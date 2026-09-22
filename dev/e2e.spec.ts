import type { APIRequestContext, Page } from '@playwright/test'

import { test as base, expect } from '@playwright/test'

import { devUser } from './helpers/credentials.js'

const readDocId = (json: unknown): number => {
  if (
    typeof json === 'object' &&
    json !== null &&
    'doc' in json &&
    typeof json.doc === 'object' &&
    json.doc !== null &&
    'id' in json.doc &&
    typeof json.doc.id === 'number'
  ) {
    return json.doc.id
  }

  throw new Error(`Expected a { doc: { id: number } } response, got: ${JSON.stringify(json)}`)
}

const readBranchRevision = (json: unknown): number => {
  if (
    typeof json === 'object' &&
    json !== null &&
    'revision' in json &&
    typeof json.revision === 'number'
  ) {
    return json.revision
  }

  throw new Error(`Expected a { revision: number } response, got: ${JSON.stringify(json)}`)
}

const readErrorCode = (json: unknown): string => {
  if (
    typeof json === 'object' &&
    json !== null &&
    'code' in json &&
    typeof json.code === 'string'
  ) {
    return json.code
  }

  throw new Error(`Expected a { code: string } response, got: ${JSON.stringify(json)}`)
}

interface BranchingFixtures {
  authedPage: Page
  createPost: (data?: Record<string, unknown>) => Promise<{ id: number }>
  request: APIRequestContext
}

base.describe.configure({ mode: 'serial' })

const test = base.extend<BranchingFixtures>({
  authedPage: async ({ page }, use) => {
    await page.goto('/admin/login')
    await page.fill('#field-email', devUser.email)
    await page.fill('#field-password', devUser.password)
    await page.click('.form-submit button')
    await expect(page).toHaveTitle(/Dashboard/)
    await use(page)
  },
  createPost: async ({ authedPage }, use) => {
    await use(async (data = {}) => {
      const response = await authedPage.request.post('/api/posts', {
        data: { title: `E2E Post ${Date.now()}-${Math.random().toString(36).slice(2)}`, ...data },
      })

      expect(response.ok()).toBeTruthy()

      return { id: readDocId(await response.json()) }
    })
  },
  request: async ({ authedPage }, use) => {
    await use(authedPage.request)
  },
})

const waitForFormReady = async (page: Page) => {
  await expect
    .poll(async () => (await page.locator('[data-form-ready="false"]').count()) === 0, {
      timeout: 10_000,
    })
    .toBe(true)
}

const waitForBranchSwitch = async (page: Page, urlMatches: (url: URL) => boolean) => {
  await page.waitForURL(urlMatches)
  await waitForFormReady(page)
}

test('should render admin panel dashboard', async ({ authedPage }) => {
  await authedPage.goto('/admin')
  await expect(authedPage).toHaveTitle(/Dashboard/)
  await expect(authedPage.getByRole('heading', { name: 'Collections' })).toBeVisible()
})

const branchSwitcherPill = (page: Page) =>
  page.locator('.branch-switcher__pill, [aria-label^="Branch:"]')

test.describe('branching is scoped to enabled collections', () => {
  test('a collection not enabled for branching shows no branch switcher', async ({
    authedPage,
  }) => {
    const upload = await authedPage.request.post('/api/media', {
      multipart: {
        file: {
          name: 'e2e-test.txt',
          buffer: Buffer.from('e2e test file'),
          mimeType: 'text/plain',
        },
      },
    })

    expect(upload.ok()).toBeTruthy()
    const mediaId = readDocId(await upload.json())

    await authedPage.goto(`/admin/collections/media/${mediaId}`)
    await expect(branchSwitcherPill(authedPage)).toHaveCount(0)
  })
})

test.describe('create, edit, and switch branches', () => {
  test('a new branch is isolated from main until saved and switched back', async ({
    authedPage,
    createPost,
  }) => {
    const post = await createPost({ title: 'Original title' })
    const branchName = `feature-${Date.now()}`

    await authedPage.goto(`/admin/collections/posts/${post.id}`)
    await authedPage.getByRole('button', { name: /^Branch: main/ }).click()
    await authedPage.getByRole('button', { name: 'New branch' }).click()
    await authedPage.getByLabel('Branch name').fill(branchName)
    await authedPage.getByRole('button', { name: 'Create branch' }).click()

    await expect(authedPage.getByText(`Created branch "${branchName}"`)).toBeVisible()

    await expect(
      authedPage.getByRole('button', { name: new RegExp(`^Branch: ${branchName}`) }),
    ).toBeVisible()

    await waitForBranchSwitch(authedPage, (url) => url.searchParams.get('branch') === branchName)

    await authedPage.locator('#field-title').fill('Edited on branch')
    await authedPage.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(authedPage.getByText(`Changes saved to "${branchName}"`)).toBeVisible()

    await authedPage.getByRole('button', { name: new RegExp(`^Branch: ${branchName}`) }).click()
    const mainOption = authedPage.getByRole('button', { name: 'main', exact: true })

    await expect(mainOption).toBeVisible()
    await mainOption.click()
    await waitForBranchSwitch(authedPage, (url) => !url.searchParams.has('branch'))
    await expect(authedPage.locator('#field-title')).toHaveValue('Original title')

    await authedPage.getByRole('button', { name: /^Branch: main/ }).click()
    const branchOption = authedPage.getByRole('button', { name: new RegExp(`^${branchName}`) })

    await expect(branchOption).toBeVisible()
    await branchOption.click()
    await waitForBranchSwitch(authedPage, (url) => url.searchParams.get('branch') === branchName)
    await expect(authedPage.locator('#field-title')).toHaveValue('Edited on branch')
  })
})

test.describe("browsing a document's branches", () => {
  test('the branch switcher lists every created branch', async ({ authedPage, createPost }) => {
    const post = await createPost()
    const branchNames = [`alpha-${Date.now()}`, `beta-${Date.now()}`]

    await authedPage.goto(`/admin/collections/posts/${post.id}`)

    for (const name of branchNames) {
      await authedPage.getByRole('button', { name: /^Branch:/ }).click()
      await authedPage.getByRole('button', { name: 'New branch' }).click()
      await authedPage.getByLabel('Branch name').fill(name)
      await authedPage.getByRole('button', { name: 'Create branch' }).click()
      await expect(authedPage.getByText(`Created branch "${name}"`)).toBeVisible()
      await waitForBranchSwitch(authedPage, (url) => url.searchParams.get('branch') === name)
    }

    await authedPage.getByRole('button', { name: /^Branch:/ }).click()

    for (const name of branchNames) {
      await expect(authedPage.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible()
    }
  })
})

test.describe('branch edits are validated', () => {
  test('clearing a required field blocks the branch save', async ({ authedPage, createPost }) => {
    const post = await createPost()
    const branchName = `validate-${Date.now()}`

    await authedPage.goto(`/admin/collections/posts/${post.id}`)
    await authedPage.getByRole('button', { name: /^Branch: main/ }).click()
    await authedPage.getByRole('button', { name: 'New branch' }).click()
    await authedPage.getByLabel('Branch name').fill(branchName)
    await authedPage.getByRole('button', { name: 'Create branch' }).click()
    await expect(authedPage.getByText(`Created branch "${branchName}"`)).toBeVisible()
    await waitForBranchSwitch(authedPage, (url) => url.searchParams.get('branch') === branchName)

    const titleField = authedPage.locator('#field-title')

    await titleField.click()
    await titleField.press('ControlOrMeta+a')
    await titleField.press('Delete')
    await expect(titleField).toHaveValue('')
    await authedPage.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(authedPage.getByText('This field is required.')).toBeVisible()
    await expect(authedPage.getByText('The following field is invalid: Title')).toBeVisible()
  })
})

test.describe('merge conflict review and apply', () => {
  test('a genuine conflict must be resolved before merging, and the pick applies to main', async ({
    authedPage,
    createPost,
    request,
  }) => {
    const post = await createPost({ title: 'Merge base title' })
    const branchName = `merge-${Date.now()}`

    const createBranch = await request.post('/api/payload-plugin-branching/branches', {
      data: { branchName, collectionSlug: 'posts', parentId: post.id },
    })

    expect(createBranch.ok()).toBeTruthy()
    const revision = readBranchRevision(await createBranch.json())

    const saveBranch = await request.post(
      `/api/payload-plugin-branching/branches/save?collectionSlug=posts&parentId=${post.id}&branch=${branchName}&expectedRevision=${revision}`,
      { multipart: { _payload: JSON.stringify({ title: 'Branch title' }) } },
    )

    expect(saveBranch.ok()).toBeTruthy()

    const patchMain = await request.patch(`/api/posts/${post.id}`, {
      data: { title: 'Main title (diverged)' },
    })

    expect(patchMain.ok()).toBeTruthy()

    await authedPage.goto(`/admin/collections/posts/${post.id}/branch-merge/${branchName}`)

    const mergeButton = authedPage.getByRole('button', { name: 'Merge into main' })

    await expect(mergeButton).toBeDisabled()

    await expect(authedPage.getByText('Main title (diverged)')).toBeVisible()
    await expect(authedPage.getByText('Branch title')).toBeVisible()

    await authedPage
      .getByRole('radio', { name: new RegExp(`Use ${branchName}`) })
      .click({ force: true })

    await expect(mergeButton).toBeEnabled()

    await mergeButton.click()
    await authedPage.getByRole('button', { name: 'Confirm merge' }).click()

    await authedPage.goto(`/admin/collections/posts/${post.id}`)
    await expect(authedPage.locator('#field-title')).toHaveValue('Branch title')
  })
})

test.describe('a branch stays usable after merging', () => {
  test('a merged field no longer shows as a conflict on the same branch', async ({
    authedPage,
    createPost,
    request,
  }) => {
    const post = await createPost({ title: 'Post-merge base' })
    const branchName = `postmerge-${Date.now()}`

    const createBranch = await request.post('/api/payload-plugin-branching/branches', {
      data: { branchName, collectionSlug: 'posts', parentId: post.id },
    })

    const revision = readBranchRevision(await createBranch.json())

    await request.post(
      `/api/payload-plugin-branching/branches/save?collectionSlug=posts&parentId=${post.id}&branch=${branchName}&expectedRevision=${revision}`,
      { multipart: { _payload: JSON.stringify({ title: 'Post-merge branch value' }) } },
    )

    await request.patch(`/api/posts/${post.id}`, { data: { title: 'Post-merge main value' } })

    await authedPage.goto(`/admin/collections/posts/${post.id}/branch-merge/${branchName}`)

    await authedPage
      .getByRole('radio', { name: new RegExp(`Use ${branchName}`) })
      .click({ force: true })

    await authedPage.getByRole('button', { name: 'Merge into main' }).click()
    await authedPage.getByRole('button', { name: 'Confirm merge' }).click()

    await authedPage.goto(`/admin/collections/posts/${post.id}/branch-merge/${branchName}`)

    await expect(
      authedPage.getByText('Nothing changed on both sides, so everything merges automatically.'),
    ).toBeVisible()

    await expect(authedPage.getByText('Ready to merge.')).toBeVisible()
  })
})

test.describe('branch content size limit', () => {
  test('branch creation is rejected once the snapshot exceeds the configured limit', async ({
    createPost,
    request,
  }) => {
    const post = await createPost()

    const oversize = await request.patch(`/api/posts/${post.id}`, {
      data: { metadata: { blob: 'x'.repeat(2 * 1024 * 1024) } },
    })

    expect(oversize.ok()).toBeTruthy()

    const response = await request.post('/api/payload-plugin-branching/branches', {
      data: { branchName: `oversized-${Date.now()}`, collectionSlug: 'posts', parentId: post.id },
    })

    expect(response.status()).toBe(422)
    expect(readErrorCode(await response.json())).toBe('SNAPSHOT_TOO_LARGE')
  })
})

test.describe('BUG-008 (fixed): saving a branch field must not falsely flag the document as modified', () => {
  test('editing a second field right after a branch save does not show "Document modified"', async ({
    authedPage,
    createPost,
  }) => {
    const post = await createPost({ summary: 'initial summary', title: 'Original title' })
    const branchName = `bug008-${Date.now()}`

    await authedPage.goto(`/admin/collections/posts/${post.id}`)
    await authedPage.getByRole('button', { name: /^Branch: main/ }).click()
    await authedPage.getByRole('button', { name: 'New branch' }).click()
    await authedPage.getByLabel('Branch name').fill(branchName)
    await authedPage.getByRole('button', { name: 'Create branch' }).click()
    await expect(authedPage.getByText(`Created branch "${branchName}"`)).toBeVisible()
    await waitForBranchSwitch(authedPage, (url) => url.searchParams.get('branch') === branchName)

    const summaryField = authedPage.locator('#field-summary')

    await summaryField.click()
    await summaryField.press('ControlOrMeta+a')
    await summaryField.press('Delete')
    await authedPage.keyboard.type('summary edited on branch')
    await authedPage.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(authedPage.getByText(`Changes saved to "${branchName}"`)).toBeVisible()

    const titleField = authedPage.locator('#field-title')

    await titleField.click()
    await titleField.press('End')
    await authedPage.keyboard.type(' v2')

    await expect(authedPage.getByText('Document modified')).toHaveCount(0)
    await expect(titleField).toHaveValue('Original title v2')

    await authedPage.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(authedPage.getByText(`Changes saved to "${branchName}"`)).toBeVisible()
  })
})
