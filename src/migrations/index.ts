import * as migration_20260819_095724_initial from './20260819_095724_initial';

export const migrations = [
  {
    up: migration_20260819_095724_initial.up,
    down: migration_20260819_095724_initial.down,
    name: '20260819_095724_initial'
  },
];
