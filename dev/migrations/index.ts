import * as migration_20260922_063152_init from './20260922_063152_init'
import * as migration_20260922_130825_sync_users_reset_password_requested_at from './20260922_130825_sync_users_reset_password_requested_at'

export const migrations = [
  {
    up: migration_20260922_063152_init.up,
    down: migration_20260922_063152_init.down,
    name: '20260922_063152_init',
  },
  {
    up: migration_20260922_130825_sync_users_reset_password_requested_at.up,
    down: migration_20260922_130825_sync_users_reset_password_requested_at.down,
    name: '20260922_130825_sync_users_reset_password_requested_at',
  },
]
