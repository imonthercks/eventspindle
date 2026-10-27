import { describe, expect, it } from 'vitest';
import { moduleName } from '../src/index';
describe('projection-memory bootstrap', () => {
  it('loads the workspace package', () =>
    expect(moduleName).toBe('@eventspindle/projection-memory'));
});
