import { describe, expect, it } from 'vitest';
import { moduleName } from '../src/index';
describe('projection-dsql bootstrap', () => {
  it('loads the workspace package', () => expect(moduleName).toBe('@eventspindle/projection-dsql'));
});
