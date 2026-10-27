import { expect, test } from 'vitest';
import { applicationName } from '../src/index';
test('example app workspace is wired', () => expect(applicationName).toBe('example-orders'));
