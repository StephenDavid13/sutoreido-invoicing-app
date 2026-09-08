import * as migration_20260818_102951_initial from './20260818_102951_initial';
import * as migration_20260819_102352_phase_2 from './20260819_102352_phase_2';
import * as migration_20260908_093309_drop_closing_line_default from './20260908_093309_drop_closing_line_default';

export const migrations = [
  {
    up: migration_20260818_102951_initial.up,
    down: migration_20260818_102951_initial.down,
    name: '20260818_102951_initial',
  },
  {
    up: migration_20260819_102352_phase_2.up,
    down: migration_20260819_102352_phase_2.down,
    name: '20260819_102352_phase_2',
  },
  {
    up: migration_20260908_093309_drop_closing_line_default.up,
    down: migration_20260908_093309_drop_closing_line_default.down,
    name: '20260908_093309_drop_closing_line_default'
  },
];
