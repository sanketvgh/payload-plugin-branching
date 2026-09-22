import type { I18nClient } from '@payloadcms/translations'
import { FieldDiffContainer } from '@payloadcms/ui/elements/FieldDiffContainer'
import { FieldDiffLabel } from '@payloadcms/ui/elements/FieldDiffLabel'
import { escapeDiffHTML, getHTMLDiffComponents } from '@payloadcms/ui/elements/HTMLDiff'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import type {
  Block,
  ClientField,
  Field,
  FieldDiffClientProps,
  FieldDiffServerProps,
  PayloadComponent,
  PayloadRequest,
} from 'payload'
import { createClientField } from 'payload'
import { fieldIsID, getUniqueListBy } from 'payload/shared'
import type { ReactNode } from 'react'

import { documentDataSchema } from '../contracts/common.js'

type Data = Record<string, unknown>
interface DiffProps {
  branch: unknown
  clientField: ClientField
  field: Field
  i18n: I18nClient
  label: string
  locale?: string
  main: unknown
  nestingLevel?: number
  req: PayloadRequest
  schemaPath: string
  selectedLocales: string[]
}

const record = (value: unknown): Data => {
  const result = documentDataSchema.safeParse(value)

  return result.success ? result.data : {}
}

const display = (value: unknown): string => {
  if (value === undefined || value === null) return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  return JSON.stringify(value, null, 2)
}

const labelFor = (field: Field, fallback: string): string => {
  if ('label' in field && typeof field.label === 'string') return field.label
  if ('name' in field && typeof field.name === 'string' && field.name !== '') return field.name

  return fallback
}

const valueID = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return value
  const id = record(value)['id']

  return typeof id === 'number' || typeof id === 'string' ? id : undefined
}

const relationLabel = async ({
  field,
  req,
  value,
}: { value: unknown } & Pick<DiffProps, 'field' | 'req'>) => {
  const id = valueID(value)

  const relationTo =
    'relationTo' in field && typeof field.relationTo === 'string' ? field.relationTo : undefined

  if (id === undefined || relationTo == null || relationTo === '') return display(value)

  try {
    const related = documentDataSchema.parse(
      await req.payload.findByID({
        id,
        collection: relationTo,
        depth: 0,
        overrideAccess: false,
        req,
      }),
    )

    const title = req.payload.collections[relationTo]?.config.admin.useAsTitle
    const label = title !== undefined ? related[title] : related['id']

    return label === undefined || label === null ? `Document ${String(id)}` : display(label)
  } catch {
    return `Document ${String(id)}`
  }
}

const Relation = async ({
  field,
  req,
  value,
}: { value: unknown } & Pick<DiffProps, 'field' | 'req'>) => {
  if (Array.isArray(value))
    return (
      <ul>
        {await Promise.all(
          value
            .slice(0, 50)
            .map(async (item, index) => (
              <li key={index}>{await relationLabel({ field, req, value: item })}</li>
            )),
        )}
      </ul>
    )

  return <span>{await relationLabel({ field, req, value })}</span>
}

const blockFor = (blocks: (Block | string)[], slug: unknown): Block | undefined =>
  typeof slug === 'string'
    ? blocks.find(
        (candidate): candidate is Block => typeof candidate !== 'string' && candidate.slug === slug,
      )
    : undefined

const blockLabel = (block: Block): string => {
  const singular = block.labels?.singular

  return typeof singular === 'string' ? singular : block.slug
}

const blockRowLabel = (index: number, fromBlock: Block | undefined, toBlock: Block | undefined) => {
  const row = `Row ${index + 1}`

  if (fromBlock && toBlock) {
    return fromBlock.slug === toBlock.slug
      ? `${row}: ${blockLabel(fromBlock)}`
      : `${row}: ${blockLabel(fromBlock)} (main) vs ${blockLabel(toBlock)} (branch)`
  }

  if (fromBlock) return `${row}: ${blockLabel(fromBlock)} (removed on branch)`
  if (toBlock) return `${row}: ${blockLabel(toBlock)} (added on branch)`

  return row
}

const Leaf = async ({ branch, field, i18n, label, locale, main, nestingLevel, req }: DiffProps) => {
  await Promise.resolve()

  if (field.type === 'relationship' || field.type === 'upload') {
    return (
      <FieldDiffContainer
        From={<Relation field={field} req={req} value={main} />}
        i18n={i18n}
        label={{ label, ...(locale != null && locale !== '' ? { locale } : {}) }}
        {...(nestingLevel !== undefined ? { nestingLevel } : {})}
        To={<Relation field={field} req={req} value={branch} />}
      />
    )
  }

  const { From, To } = getHTMLDiffComponents({
    fromHTML: `<pre>${escapeDiffHTML(display(main))}</pre>`,
    toHTML: `<pre>${escapeDiffHTML(display(branch))}</pre>`,
    tokenizeByCharacter: typeof main === 'string' && typeof branch === 'string',
  })

  return (
    <FieldDiffContainer
      From={From}
      i18n={i18n}
      label={{ label, ...(locale != null && locale !== '' ? { locale } : {}) }}
      {...(nestingLevel !== undefined ? { nestingLevel } : {})}
      To={To}
    />
  )
}

const Nested = async ({
  branch,
  fields,
  i18n,
  main,
  nestingLevel,
  req,
}: {
  branch: Data
  fields: Field[]
  i18n: I18nClient
  main: Data
  nestingLevel: number
  req: PayloadRequest
}) => {
  await Promise.resolve()

  return (
    <div className="branch-merge-field__children">
      {fields
        .filter((field) => !fieldIsID(field))
        .map(async (field, index) => {
          await Promise.resolve()
          const name = 'name' in field && typeof field.name === 'string' ? field.name : undefined

          return (
            <FallbackDiff
              branch={name !== undefined ? branch[name] : branch}
              field={field}
              i18n={i18n}
              key={`${name ?? field.type}-${index}`}
              label={labelFor(field, `Field ${index + 1}`)}
              main={name !== undefined ? main[name] : main}
              nestingLevel={nestingLevel}
              req={req}
              schemaPath={name ?? ''}
              selectedLocales={[]}
              clientField={createClientField({
                defaultIDType: req.payload.config.db.defaultIDType,
                field,
                i18n,
                importMap: req.payload.importMap,
              })}
            />
          )
        })}
    </div>
  )
}

const FallbackDiff = async (props: DiffProps): Promise<ReactNode> => {
  await Promise.resolve()
  const { branch, field, i18n, label, main, nestingLevel = 0, req } = props

  if (field.type === 'tabs') {
    return (
      <section className="branch-merge-field branch-merge-field--tabs">
        <FieldDiffLabel>{label}</FieldDiffLabel>
        {field.tabs.map((tab, index) => {
          const name = 'name' in tab && typeof tab.name === 'string' ? tab.name : undefined
          const tabLabel = typeof tab.label === 'string' ? tab.label : (name ?? `Tab ${index + 1}`)

          return (
            <section key={tabLabel}>
              <FieldDiffLabel>{tabLabel}</FieldDiffLabel>
              <Nested
                branch={name !== undefined ? record(record(branch)[name]) : record(branch)}
                fields={tab.fields}
                i18n={i18n}
                main={name !== undefined ? record(record(main)[name]) : record(main)}
                nestingLevel={nestingLevel + 1}
                req={req}
              />
            </section>
          )
        })}
      </section>
    )
  }

  if (field.type === 'blocks') {
    const from = Array.isArray(main) ? main : []
    const to = Array.isArray(branch) ? branch : []
    const length = Math.max(from.length, to.length)

    return (
      <section className="branch-merge-field branch-merge-field--blocks">
        <FieldDiffLabel>{label}</FieldDiffLabel>
        {Array.from({ length }, (_, index) => {
          const fromRow = record(from[index])
          const toRow = record(to[index])
          const fromBlock = blockFor(field.blocks, fromRow['blockType'])
          const toBlock = blockFor(field.blocks, toRow['blockType'])

          if (!fromBlock && !toBlock) return <Leaf {...props} key={index} />

          const rowFields = getUniqueListBy<Field>(
            [...(fromBlock?.fields ?? []), ...(toBlock?.fields ?? [])],
            'name',
          )

          return (
            <section className="branch-merge-field__row" key={index}>
              <FieldDiffLabel>{blockRowLabel(index, fromBlock, toBlock)}</FieldDiffLabel>
              <Nested
                branch={toRow}
                fields={rowFields}
                i18n={i18n}
                main={fromRow}
                nestingLevel={nestingLevel + 1}
                req={req}
              />
            </section>
          )
        })}
      </section>
    )
  }

  if (field.type === 'array') {
    const from = Array.isArray(main) ? main : []
    const to = Array.isArray(branch) ? branch : []
    const arrayFields = 'fields' in field && Array.isArray(field.fields) ? field.fields : []
    const length = Math.max(from.length, to.length)

    return (
      <section className="branch-merge-field branch-merge-field--array">
        <FieldDiffLabel>{label}</FieldDiffLabel>
        {Array.from({ length }, (_, index) => (
          <Nested
            branch={record(to[index])}
            fields={arrayFields}
            i18n={i18n}
            key={index}
            main={record(from[index])}
            nestingLevel={nestingLevel + 1}
            req={req}
          />
        ))}
      </section>
    )
  }

  const nestedFields = 'fields' in field && Array.isArray(field.fields) ? field.fields : []

  if (nestedFields.length > 0)
    return (
      <section className={`branch-merge-field branch-merge-field--${field.type}`}>
        <FieldDiffLabel>{label}</FieldDiffLabel>
        <Nested
          branch={record(branch)}
          fields={nestedFields}
          i18n={i18n}
          main={record(main)}
          nestingLevel={nestingLevel + (field.type === 'row' ? 0 : 1)}
          req={req}
        />
      </section>
    )

  return <Leaf {...props} />
}

export const BranchMergeFieldDiff = async (props: DiffProps): Promise<ReactNode> => {
  const { clientField, field, i18n, req, selectedLocales } = props

  let Component: PayloadComponent | undefined =
    field.type === 'richText' && 'editor' in field && typeof field.editor !== 'function'
      ? field.editor.DiffComponent
      : undefined

  const diffComponent = field.admin?.components?.Diff

  if (diffComponent !== undefined) Component = diffComponent
  if (Component === undefined) return <FallbackDiff {...props} />

  const clientProps: FieldDiffClientProps = {
    baseVersionField: {
      type: field.type,
      fields: [],
      path: props.label,
      schemaPath: props.schemaPath,
    },
    comparisonValue: props.main,
    diffMethod: 'diffWordsWithSpace',
    field: clientField,
    fieldPermissions: true,
    ...(props.locale != null && props.locale !== '' ? { locale: props.locale } : {}),
    parentIsLocalized: false,
    versionValue: props.branch,
  }

  const serverProps: FieldDiffServerProps = {
    ...clientProps,
    clientField,
    field,
    i18n,
    req,
    selectedLocales,
  }

  return RenderServerComponent({
    clientProps,
    Component,
    importMap: req.payload.importMap,
    key: props.label,
    serverProps,
  })
}
