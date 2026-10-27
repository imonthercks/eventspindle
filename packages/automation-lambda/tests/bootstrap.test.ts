import { describe, expect, it } from 'vitest';
import { moduleName } from '../src/index';
describe('automation-lambda bootstrap', () => {
  it('loads the workspace package', () =>
    expect(moduleName).toBe('@eventspindle/automation-lambda'));
});
