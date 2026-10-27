import { describe, expect, it } from 'vitest';
import { moduleName } from '../src/index';
describe('projection-core bootstrap', () => {
  it('loads the workspace package', () => expect(moduleName).toBe('@eventspindle/projection-core'));
});
