import { describe, it, expect } from 'vitest';
import { startOfMonth, endOfMonth, subMonths, subDays, startOfYear } from 'date-fns';
import {
  formatDateForInput,
  getDefaultDateRange,
  getDatePreset,
  datePresets,
} from '../dateUtils';

describe('formatDateForInput', () => {
  it('formats a date as yyyy-MM-dd', () => {
    expect(formatDateForInput(new Date('2025-03-15T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formats known dates correctly', () => {
    expect(formatDateForInput(new Date(2025, 0, 1))).toBe('2025-01-01');   // Jan 1
    expect(formatDateForInput(new Date(2025, 11, 31))).toBe('2025-12-31'); // Dec 31
  });
});

describe('getDefaultDateRange', () => {
  it('returns an object with startDate and endDate', () => {
    const range = getDefaultDateRange();
    expect(range).toHaveProperty('startDate');
    expect(range).toHaveProperty('endDate');
    expect(range.startDate).toBeInstanceOf(Date);
    expect(range.endDate).toBeInstanceOf(Date);
  });

  it('returns the first and last day of last month', () => {
    const lastMonth = subMonths(new Date(), 1);
    const { startDate, endDate } = getDefaultDateRange();
    expect(formatDateForInput(startDate)).toBe(formatDateForInput(startOfMonth(lastMonth)));
    expect(formatDateForInput(endDate)).toBe(formatDateForInput(endOfMonth(lastMonth)));
  });

  it('returns startDate before endDate', () => {
    const { startDate, endDate } = getDefaultDateRange();
    expect(startDate.getTime()).toBeLessThan(endDate.getTime());
  });
});

describe('getDatePreset', () => {
  it('returns getDates() result for a valid preset value', () => {
    const result = getDatePreset('last-month');
    expect(result).not.toBeNull();
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
  });

  it('returns null for an unknown preset value', () => {
    expect(getDatePreset('unknown-preset')).toBeNull();
    expect(getDatePreset('')).toBeNull();
  });

  it('resolves every preset without throwing', () => {
    for (const preset of datePresets) {
      expect(() => getDatePreset(preset.value)).not.toThrow();
    }
  });
});

describe('datePresets', () => {
  it('contains all expected preset values', () => {
    const values = datePresets.map((p) => p.value);
    expect(values).toContain('last-month');
    expect(values).toContain('this-month');
    expect(values).toContain('last-7-days');
    expect(values).toContain('last-30-days');
    expect(values).toContain('last-90-days');
    expect(values).toContain('year-to-date');
  });

  it('every preset returns startDate <= endDate', () => {
    for (const preset of datePresets) {
      const { startDate, endDate } = preset.getDates();
      expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
    }
  });

  it('every preset has a non-empty label', () => {
    for (const preset of datePresets) {
      expect(preset.label).toBeTruthy();
    }
  });

  it('last-7-days startDate is approximately 7 days ago', () => {
    const { startDate } = getDatePreset('last-7-days');
    const expected = subDays(new Date(), 7);
    const diffMs = Math.abs(startDate.getTime() - expected.getTime());
    expect(diffMs).toBeLessThan(5000); // within 5 seconds
  });

  it('year-to-date startDate is the start of this year', () => {
    const { startDate } = getDatePreset('year-to-date');
    const expected = startOfYear(new Date());
    expect(formatDateForInput(startDate)).toBe(formatDateForInput(expected));
  });
});
