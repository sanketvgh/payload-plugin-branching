import * as migration_20260906_073705_initial from './20260906_073705_initial'

export const migrations = [
  {
    name: '20260906_073705_initial',
    down: migration_20260906_073705_initial.down,
    up: migration_20260906_073705_initial.up,
  },
]
