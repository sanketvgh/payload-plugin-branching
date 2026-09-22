'use client'

import '../components/index.scss'

import {
  Banner,
  Button,
  Collapsible,
  ConfirmationModal,
  FieldDiffContainer,
  Gutter,
  Pill,
  PillSelector,
  toast,
  useConfig,
  useDocumentTitle,
  useDrawerSlug,
  useModal,
  useRouteTransition,
  useStepNav,
  useTranslation,
} from '@payloadcms/ui'
import { Radio } from '@payloadcms/ui/fields/RadioGroup/Radio'
import { useRouter } from 'next/navigation.js'
import { formatAdminURL } from 'payload/shared'
import type { Dispatch, FC, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import type { MergePick, MergePreview } from '../operations/mergeTypes.js'

type Doc = Record<string, unknown>
interface FieldSchema {
  label?: Record<string, string> | string
  name?: string
  type?: string
}
interface ConflictUnit {
  fields: string[]
  key: string
  locale?: string
}
interface AutomaticUnit {
  fields: string[]
  key: string
  source?: string
}
type ApplyState = 'done' | 'error' | 'idle' | 'saving' | 'stale'

const baseClass = 'merge-review'

const errorBodySchema = z.object({ error: z.string().optional() })

export interface BranchMergeViewClientProps {
  apiPath: string
  branch: Doc
  branchName: string
  collectionSlug: string
  fields?: FieldSchema[]
  main: Doc
  parentId: number | string
  preview: {
    automatic?: AutomaticUnit[]
    conflicts?: ConflictUnit[]
  } & MergePreview
  renderedDiffs?: Record<string, ReactNode>
}

const display = (value: unknown): string => {
  if (value === undefined) return 'Not set'
  if (value === null) return 'None'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  return JSON.stringify(value, null, 2)
}

const unitValue = (doc: Doc, unit: ConflictUnit): unknown =>
  unit.fields.length === 1
    ? doc[unit.fields[0] ?? '']
    : Object.fromEntries(unit.fields.map((f) => [f, doc[f]]))

const fieldLabel = (fields: FieldSchema[], name: string): string => {
  const schema = fields.find((field) => field.name === name)

  return typeof schema?.label === 'string' ? schema.label : name
}

const MergeStepNav: FC<{
  branchName: string
  collectionSlug: string
  parentId: number | string
}> = ({ branchName, collectionSlug, parentId }) => {
  const { config } = useConfig()
  const { setStepNav } = useStepNav()
  const { title } = useDocumentTitle()
  const plural = config.collections.find((c) => c.slug === collectionSlug)?.labels.plural
  const collectionLabel = typeof plural === 'string' ? plural : collectionSlug
  const adminRoute = config.routes.admin

  useEffect(() => {
    setStepNav([
      {
        label: collectionLabel,
        url: formatAdminURL({ adminRoute, path: `/collections/${collectionSlug}` }),
      },
      {
        label: title,
        url: formatAdminURL({
          adminRoute,
          path: `/collections/${collectionSlug}/${String(parentId)}`,
        }),
      },
      { label: `Merge ${branchName}` },
    ])
  }, [adminRoute, branchName, collectionLabel, collectionSlug, parentId, setStepNav, title])

  return null
}

const Conflict: FC<{
  branch: Doc
  branchName: string
  fields: FieldSchema[]
  main: Doc
  onPick: (pick: MergePick) => void
  pick: MergePick | undefined
  renderedDiff: ReactNode | undefined
  unit: ConflictUnit
}> = ({ branch, branchName, fields, main, onPick, pick, renderedDiff, unit }) => {
  const { i18n } = useTranslation()
  const label = unit.fields.length === 1 ? fieldLabel(fields, unit.key) : unit.fields.join(', ')
  const path = `merge-pick-${unit.key}`

  return (
    <Collapsible
      className={`${baseClass}__conflict`}
      header={
        <div className={`${baseClass}__conflict-header`}>
          <span>{label}</span>
          {unit.locale !== undefined && <Pill size="small">{unit.locale}</Pill>}
          {pick === undefined ? (
            <Pill pillStyle="warning" size="small">
              Unresolved
            </Pill>
          ) : (
            <Pill pillStyle="success" size="small">
              {pick === 'main' ? 'Keeping main' : `Using ${branchName}`}
            </Pill>
          )}
        </div>
      }
    >
      {renderedDiff ?? (
        <FieldDiffContainer
          From={<pre>{display(unitValue(main, unit))}</pre>}
          i18n={i18n}
          label={{ label, ...(unit.locale !== undefined ? { locale: unit.locale } : {}) }}
          To={<pre>{display(unitValue(branch, unit))}</pre>}
        />
      )}
      <div className={`${baseClass}__conflict-picks`}>
        <Radio
          id={`${path}-main`}
          isSelected={pick === 'main'}
          option={{ label: 'Keep main', value: 'main' }}
          path={path}
          onChange={() => {
            onPick('main')
          }}
        />
        <Radio
          id={`${path}-branch`}
          isSelected={pick === 'branch'}
          option={{ label: `Use ${branchName}`, value: 'branch' }}
          path={path}
          onChange={() => {
            onPick('branch')
          }}
        />
      </div>
    </Collapsible>
  )
}

const AutomaticChanges: FC<{
  automatic: AutomaticUnit[]
  branchName: string
  fields: FieldSchema[]
}> = ({ automatic, branchName, fields }) => {
  if (automatic.length === 0) return null

  return (
    <Collapsible
      initCollapsed
      className={`${baseClass}__automatic`}
      header={`Changes without conflicts (${String(automatic.length)})`}
    >
      <p className={`${baseClass}__muted`}>
        These fields changed on one side only and merge as they are.
      </p>
      <ul className={`${baseClass}__field-list`}>
        {automatic.map((unit) => (
          <li key={unit.key}>
            <Pill size="small">
              {unit.fields.map((name) => fieldLabel(fields, name)).join(', ')}
              <span className={`${baseClass}__muted`}>
                {' '}
                from {unit.source === 'main' ? 'main' : branchName}
              </span>
            </Pill>
          </li>
        ))}
      </ul>
    </Collapsible>
  )
}

const MergeControls: FC<{
  allLocales: string[]
  branchName: string
  conflictCount: number
  selectedLocales: string[]
  setSelectedLocales: Dispatch<SetStateAction<string[]>>
}> = ({ allLocales, branchName, conflictCount, selectedLocales, setSelectedLocales }) => (
  <Gutter className={`${baseClass}__controls`}>
    <div>
      <h2 id="branch-merge-title">
        Merge <code>{branchName}</code> into main
      </h2>
      <p className={`${baseClass}__muted`}>
        {conflictCount === 0
          ? 'Nothing changed on both sides, so everything merges automatically.'
          : 'Fields changed on both sides need a decision. Pick a version for each one.'}
      </p>
    </div>
    {allLocales.length > 0 && (
      <PillSelector
        pills={allLocales.map((name) => ({ name, selected: selectedLocales.includes(name) }))}
        onClick={({ pill }) => {
          setSelectedLocales((current) =>
            current.includes(pill.name)
              ? current.filter((name) => name !== pill.name)
              : [...current, pill.name],
          )
        }}
      />
    )}
  </Gutter>
)

const ColumnHeader: FC<{
  description: string
  name: string
  onChooseAll: (() => void) | undefined
}> = ({ name, description, onChooseAll }) => (
  <div className={`${baseClass}__column`}>
    <div className={`${baseClass}__column-label`}>
      <span>{name}</span>
      <span className={`${baseClass}__muted`}>{description}</span>
    </div>
    {onChooseAll !== undefined && (
      <Button
        aria-label={`Use ${name} for every conflict`}
        buttonStyle="pill"
        margin={false}
        onClick={onChooseAll}
        size="small"
      >
        Use for all
      </Button>
    )}
  </div>
)

const useMergeApply = ({
  apiPath,
  branchName,
  collectionSlug,
  parentId,
  picks,
  preview,
}: {
  picks: Record<string, MergePick>
} & Pick<
  BranchMergeViewClientProps,
  'apiPath' | 'branchName' | 'collectionSlug' | 'parentId' | 'preview'
>) => {
  const router = useRouter()
  const { startRouteTransition } = useRouteTransition()
  const { config } = useConfig()
  const [state, setState] = useState<ApplyState>('idle')
  const [message, setMessage] = useState('')
  const operationId = useMemo(() => crypto.randomUUID(), [])

  const body = useMemo(
    () => ({
      branch: branchName,
      collectionSlug,
      operationId,
      parentId,
      picks,
      previewToken: preview.previewToken,
      revision: preview.revision,
    }),
    [
      branchName,
      collectionSlug,
      operationId,
      parentId,
      picks,
      preview.previewToken,
      preview.revision,
    ],
  )

  const apply = async () => {
    setState('saving')
    setMessage('')

    try {
      const response = await fetch(apiPath, {
        body: JSON.stringify(body),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const parsedJSON = errorBodySchema.safeParse(await response.json().catch(() => ({})))
      const json = parsedJSON.success ? parsedJSON.data : {}

      if (response.status === 409) {
        setState('stale')
        setMessage(json.error ?? 'The document changed. Refresh the preview and try again.')

        return
      }

      if (!response.ok) {
        setState('error')
        setMessage(json.error ?? 'The merge could not be applied.')

        return
      }

      setState('done')
      toast.success(`Merged "${branchName}" into main.`)

      startRouteTransition(() => {
        router.push(
          formatAdminURL({
            adminRoute: config.routes.admin,
            path: `/collections/${collectionSlug}/${String(parentId)}`,
          }),
        )
      })
    } catch {
      setState('error')
      setMessage('The merge could not be applied. Check your connection and try again.')
    }
  }

  return { apply, message, state }
}

export const BranchMergeViewClient: FC<BranchMergeViewClientProps> = ({
  apiPath,
  branch,
  branchName,
  collectionSlug,
  fields = [],
  main,
  parentId,
  preview,
  renderedDiffs = {},
}) => {
  const conflicts = preview.conflicts
  const automatic = preview.automatic
  const [picks, setPicks] = useState<Record<string, MergePick>>({})
  const [confirming, setConfirming] = useState(false)
  const confirmSlug = useDrawerSlug('branch-merge-confirm')
  const { closeModal, openModal } = useModal()

  const allLocales = useMemo(
    () =>
      Array.from(
        new Set(conflicts.flatMap((unit) => (unit.locale === undefined ? [] : [unit.locale]))),
      ),
    [conflicts],
  )

  const [selectedLocales, setSelectedLocales] = useState<string[]>(allLocales)

  const visibleConflicts = conflicts.filter(
    (unit) => unit.locale === undefined || selectedLocales.includes(unit.locale),
  )

  const selected = conflicts.filter((unit) => picks[unit.key] !== undefined).length
  const remaining = conflicts.length - selected
  const allPicked = remaining === 0

  const chooseAll = (pick: MergePick) => {
    setPicks(Object.fromEntries(conflicts.map((unit) => [unit.key, pick])))
  }

  const { apply, message, state } = useMergeApply({
    apiPath,
    branchName,
    collectionSlug,
    parentId,
    picks,
    preview,
  })

  let footerText = `${String(remaining)} of ${String(conflicts.length)} conflicts left to resolve.`

  if (conflicts.length === 0) footerText = 'Ready to merge.'
  else if (allPicked) footerText = 'All conflicts resolved.'

  return (
    <main aria-labelledby="branch-merge-title" className={baseClass}>
      <MergeStepNav branchName={branchName} collectionSlug={collectionSlug} parentId={parentId} />
      <MergeControls
        allLocales={allLocales}
        branchName={branchName}
        conflictCount={conflicts.length}
        selectedLocales={selectedLocales}
        setSelectedLocales={setSelectedLocales}
      />
      <Gutter className={`${baseClass}__columns`}>
        <ColumnHeader
          description="current main content"
          name="main"
          onChooseAll={
            conflicts.length > 0
              ? () => {
                  chooseAll('main')
                }
              : undefined
          }
        />
        <ColumnHeader
          description="branch content"
          name={branchName}
          onChooseAll={
            conflicts.length > 0
              ? () => {
                  chooseAll('branch')
                }
              : undefined
          }
        />
      </Gutter>
      <Gutter className={`${baseClass}__body`}>
        <AutomaticChanges automatic={automatic} branchName={branchName} fields={fields} />
        {conflicts.length === 0 && (
          <Banner type="success">No conflicts. {branchName} can be merged as is.</Banner>
        )}
        {visibleConflicts.map((unit) => (
          <Conflict
            branch={branch}
            branchName={branchName}
            fields={fields}
            key={unit.key}
            main={main}
            pick={picks[unit.key]}
            renderedDiff={renderedDiffs[unit.key]}
            unit={unit}
            onPick={(pick) => {
              setPicks((p) => ({ ...p, [unit.key]: pick }))
            }}
          />
        ))}
        {message !== '' && (
          <Banner type="error">
            <span role="alert">{message}</span>
          </Banner>
        )}
      </Gutter>
      <div className={`${baseClass}__footer`}>
        <span className={`${baseClass}__muted`}>{footerText}</span>
        <Button
          buttonStyle="primary"
          disabled={!allPicked || state === 'saving' || state === 'done'}
          size="medium"
          onClick={() => {
            setConfirming(true)
            openModal(confirmSlug)
          }}
        >
          {state === 'saving' ? 'Merging…' : 'Merge into main'}
        </Button>
        {confirming && (
          <ConfirmationModal
            body={<p>This applies the selected values to main and updates branch bookkeeping.</p>}
            confirmingLabel="Merging…"
            confirmLabel="Confirm merge"
            heading={`Merge ${branchName} into main?`}
            modalSlug={confirmSlug}
            onConfirm={() => {
              setConfirming(false)
              closeModal(confirmSlug)
              void apply()
            }}
          />
        )}
      </div>
    </main>
  )
}
