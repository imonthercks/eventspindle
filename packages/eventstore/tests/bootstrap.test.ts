import { describe, expect, it } from 'vitest';
import { moduleName } from '../src/index';
describe('eventstore bootstrap', () => {
  it('loads the workspace package', () => expect(moduleName).toBe('@eventspindle/eventstore'));
});
