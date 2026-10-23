import { expect, test } from 'vitest';
import { daysLeft } from './data';

test('daysLeft', () => {
  const today = new Date('2026-10-23T00:00:00Z');
  expect(daysLeft('2026-10-30', today)).toBe(7);
  expect(daysLeft('2026-10-20', today)).toBeLessThan(0);
  expect(daysLeft(undefined, today)).toBeUndefined();
});
