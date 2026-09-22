import * as migration_20260922_063152_init from './20260922_063152_init'

export const migrations = [
  {
    up: migration_20260922_063152_init.up,
    down: migration_20260922_063152_init.down,
    name: '20260922_063152_init',
  },
]
