import * as migration_20260818_102951_initial from './20260818_102951_initial';

export const migrations = [
  {
    up: migration_20260818_102951_initial.up,
    down: migration_20260818_102951_initial.down,
    name: '20260818_102951_initial'
  },
];
