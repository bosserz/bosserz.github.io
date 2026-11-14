import { describe, expect, it } from 'vitest';
import { dateLabel, todayTripDay } from './trip';

describe('trip calendar', () => {
  it('labels Day 1..4 as 1..4 Jan 2027', () => {
    expect([1, 2, 3, 4].map(dateLabel)).toEqual(['Fri 1 Jan', 'Sat 2 Jan', 'Sun 3 Jan', 'Mon 4 Jan']);
  });
  it("knows which trip day today is (local time), and null outside the trip", () => {
    expect(todayTripDay(new Date(2027, 0, 1, 8, 0))).toBe(1);
    expect(todayTripDay(new Date(2027, 0, 4, 23, 59))).toBe(4);
    expect(todayTripDay(new Date(2026, 11, 31, 23, 59))).toBeNull();
    expect(todayTripDay(new Date(2027, 0, 5, 0, 1))).toBeNull();
  });
});
