import { describe, it, expect } from 'vitest';
import { parseHHMM } from '../src/utils/date';

describe('parseHHMM', () => {
  it('parses valid HH:MM', () => {
    expect(parseHHMM('18:30')).toBe(1110);
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('23:59')).toBe(1439);
  });

  it('returns 0 for invalid input', () => {
    expect(parseHHMM('')).toBe(0);
    expect(parseHHMM('bad')).toBe(0);
    expect(parseHHMM(undefined as unknown as string)).toBe(0);
  });
});
