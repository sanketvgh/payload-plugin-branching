import type { ReactElement } from 'react'

export const Greeting = (): ReactElement => {
  return (
    <div>
      <span aria-label="waving hand" role="img">
        👋
      </span>{' '}
      Hello from payload-plugin-branching!
    </div>
  )
}
