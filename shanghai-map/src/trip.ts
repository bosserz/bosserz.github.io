/**
 * Trip calendar. Day N in places.csv = TRIP_START + (N - 1) days.
 * Change TRIP_START to move the whole trip; edit DAYS to rename a day.
 */
export const TRIP_START = '2027-01-01';

export interface TripDay {
  day: number;
  title: string;
  base: string;
  /** Route line + day chip accent. */
  color: string;
}

export const DAYS: TripDay[] = [
  { day: 1, title: 'Nanjing East Rd & The Bund', base: "People's Square / Nanjing East Rd metro (Lines 1, 2, 8, 10)", color: '#c2255c' },
  { day: 2, title: 'Old City & Pudong', base: 'Yuyuan Garden metro (Lines 10, 14) → Lujiazui (Lines 2, 14)', color: '#6741d9' },
  { day: 3, title: 'Former French Concession', base: 'Shanghai Library / Jiaotong Univ. (Lines 10, 11) → Huaihai Middle Rd (13)', color: '#0c8599' },
  { day: 4, title: "West Bund, Jing'an & Xintiandi", base: "Taxi → West Nanjing Rd (Lines 2, 12, 13) → Xintiandi (10, 13)", color: '#e67700' },
];

function dateOf(day: number): Date {
  const [y, m, d] = TRIP_START.split('-').map(Number);
  return new Date(y, m - 1, d + day - 1);
}

/** "Fri 1 Jan" */
export function dateLabel(day: number): string {
  return dateOf(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The trip day that is today on this device, or null outside the trip. */
export function todayTripDay(now = new Date()): number | null {
  const start = dateOf(1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const n = Math.round((today.getTime() - start.getTime()) / 86400000) + 1;
  return DAYS.some((d) => d.day === n) ? n : null;
}

export const dayInfo = (day: number | null) => DAYS.find((d) => d.day === day);
