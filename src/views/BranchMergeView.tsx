import type { DocumentViewServerProps } from 'payload'
import { createClientField, createLocalReq } from 'payload'
import type { ReactNode } from 'react'

import { documentDataSchema, transportIDSchema } from '../contracts/common.js'
import { mergeBranch } from '../operations/mergeBranch.js'
import type { MergeBranchResult } from '../operations/mergeBranch.js'
import { resolveBranch } from '../operations/resolveBranch.js'
import type { ResolveBranchResult } from '../operations/resolveBranch.js'

import { BranchMergeFieldDiff } from './BranchMergeFieldDiff.js'
import { BranchMergeViewClient, type BranchMergeViewClientProps } from './BranchMergeViewClient.js'

const branchFromSegments = (segments: string[]) =>
  decodeURIComponent(segments[segments.length - 1] ?? '')

export const BranchMergeView = async (props: DocumentViewServerProps): Promise<ReactNode> => {
  const collectionSlug = props.initPageResult.collectionConfig?.slug

  if (collectionSlug == null || collectionSlug === '') {
    throw new Error('Merge review requires a collection document')
  }

  const mainDoc = documentDataSchema.parse(props.doc)
  const parentId = transportIDSchema.parse(props.id ?? mainDoc['id'])
  const branchName = branchFromSegments(props.routeSegments)

  const req = await createLocalReq(
    props.user === undefined ? {} : { user: props.user },
    props.payload,
  )

  const result: MergeBranchResult = await mergeBranch({
    branch: branchName,
    collectionSlug,
    parentId,
    payload: req.payload,
    req,
  })

  const resolved: ResolveBranchResult = await resolveBranch({
    branch: branchName,
    collectionSlug,
    parentId,
    payload: req.payload,
    req,
  })

  const mergeResult = result
  const conflicts = mergeResult.contested
  const automatic = mergeResult.automatic

  if (mergeResult.previewToken === '') {
    throw new Error('Merge preview did not return the required branch identity and preview token')
  }

  const fields = props.initPageResult.collectionConfig?.fields ?? []
  const renderedDiffs: Record<string, ReactNode> = {}

  for (const unit of conflicts) {
    const field = fields.find((candidate) => 'name' in candidate && candidate.name === unit.key)

    if (!field) continue

    renderedDiffs[unit.key] = (
      <BranchMergeFieldDiff
        field={field}
        i18n={props.i18n}
        label={unit.key}
        req={req}
        schemaPath={unit.key}
        selectedLocales={[]}
        branch={
          unit.fields.length === 1
            ? resolved.resolvedDoc[unit.key]
            : Object.fromEntries(
                unit.fields.map((name: string) => [name, resolved.resolvedDoc[name]]),
              )
        }
        clientField={createClientField({
          defaultIDType: props.payload.config.db.defaultIDType,
          field,
          i18n: props.i18n,
          importMap: props.payload.importMap,
        })}
        main={
          unit.fields.length === 1
            ? mainDoc[unit.key]
            : Object.fromEntries(unit.fields.map((name: string) => [name, mainDoc[name]]))
        }
      />
    )
  }

  const preview: BranchMergeViewClientProps['preview'] = {
    automatic,
    base: mergeResult.base,
    branch: mergeResult.branch,
    conflicts,
    contractVersion: 1,
    previewToken: mergeResult.previewToken,
    revision: mergeResult.revision,
    target: mergeResult.target,
  }

  return (
    <BranchMergeViewClient
      apiPath={`${req.payload.config.routes.api}/payload-plugin-branching/branches/merge-apply`}
      branch={resolved.resolvedDoc}
      branchName={branchName}
      collectionSlug={collectionSlug}
      main={mainDoc}
      parentId={parentId}
      preview={preview}
      renderedDiffs={renderedDiffs}
      fields={fields.map((f) => {
        const field = {
          name: 'name' in f && typeof f.name === 'string' ? f.name : '',
          type: f.type,
        }

        return 'label' in f && typeof f.label === 'string' ? { ...field, label: f.label } : field
      })}
    />
  )
}
