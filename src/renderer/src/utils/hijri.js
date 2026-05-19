/**
 * Hijri (Islamic) calendar conversion utility.
 * Uses the Kuwaiti algorithm approximation — suitable for display purposes.
 */

const HIJRI_EPOCH = 227015; // Julian day of 1 Muharram 1 AH (approx)

/**
 * Converts a Gregorian Date to Hijri date object.
 * @param {Date} date - Gregorian date (defaults to today)
 * @returns {{ year: number, month: number, day: number, monthName: string, formatted: string }}
 */
export function toHijri(date = new Date()) {
  const jd = gregorianToJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return julianDayToHijri(jd);
}

/**
 * Converts a Gregorian Date to a formatted Hijri string.
 * @param {Date} date
 * @returns {string} e.g. "1 Ramadan 1446 AH"
 */
export function formatHijri(date = new Date()) {
  const h = toHijri(date);
  return `${h.day} ${h.monthName} ${h.year} AH`;
}

/**
 * Converts a Gregorian Date to a short formatted Hijri string.
 * @param {Date} date
 * @returns {string} e.g. "1446-09-01"
 */
export function formatHijriShort(date = new Date()) {
  const h = toHijri(date);
  const m = String(h.month).padStart(2, '0');
  const d = String(h.day).padStart(2, '0');
  return `${h.year}-${m}-${d}`;
}

/**
 * Returns Hijri month names.
 */
export function getHijriMonthName(month) {
  const names = [
    'Muharram', 'Safar', 'Rabi\' al-Awwal', 'Rabi\' al-Thani',
    'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab',
    'Sha\'ban', 'Ramadan', 'Shawwal',
    'Dhul-Qi\'dah', 'Dhul-Hijjah',
  ];
  return names[(month - 1) % 12] || '';
}

// ---- Internal helpers ----

function gregorianToJulianDay(y, m, d) {
  let yy = y;
  let mm = m;
  if (mm <= 2) {
    yy -= 1;
    mm += 12;
  }
  const A = Math.floor(yy / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + B - 1524;
}

function julianDayToHijri(jd) {
  const l = jd - HIJRI_EPOCH + 10631;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;

  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  const monthName = getHijriMonthName(month);

  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');

  return { year, month, day, monthName, formatted: `${year}-${m}-${d}` };
}