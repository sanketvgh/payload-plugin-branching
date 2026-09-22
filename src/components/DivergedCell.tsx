import type { CheckboxFieldClient, DefaultCellComponentProps } from 'payload'
import { type FC } from 'react'

const baseClass = 'diverged-cell'

export const DivergedCell: FC<DefaultCellComponentProps<CheckboxFieldClient>> = ({ cellData }) => {
  if (!cellData) {
    return <span className={`${baseClass}__clean`}>Up to date</span>
  }

  return (
    <span className={baseClass}>
      <span aria-hidden className={`${baseClass}__dot`} />
      Changes not merged
    </span>
  )
}
