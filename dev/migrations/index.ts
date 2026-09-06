import * as migration_20260906_151459_initial from './20260906_151459_initial'

export const migrations = [
  {
    name: '20260906_151459_initial',
    down: migration_20260906_151459_initial.down,
    up: migration_20260906_151459_initial.up,
  },
]
