import * as migration_20260818_102951_initial from './20260818_102951_initial';
import * as migration_20260819_102352_phase_2 from './20260819_102352_phase_2';

export const migrations = [
  {
    up: migration_20260818_102951_initial.up,
    down: migration_20260818_102951_initial.down,
    name: '20260818_102951_initial',
  },
  {
    up: migration_20260819_102352_phase_2.up,
    down: migration_20260819_102352_phase_2.down,
    name: '20260819_102352_phase_2'
  },
];
