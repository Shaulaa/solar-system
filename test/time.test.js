import { describe, expect, it } from 'vitest';
import { DATE_RANGE, daysFromStart, isoDate, parseIsoDate, simDate } from '../src/utils/time.js';

describe('tanggal pilihan user', () => {
  it('tanggal yang benar dibaca jadi tahun, bulan 1 sampai 12, tanggal', () => {
    expect(parseIsoDate('2027-01-10')).toEqual({ year: 2027, month: 1, date: 10 });
    expect(parseIsoDate('2028-02-29')).toEqual({ year: 2028, month: 2, date: 29 });
  });

  it('batas rentang masih boleh, di luarnya ditolak', () => {
    expect(parseIsoDate(DATE_RANGE.min)).not.toBeNull();
    expect(parseIsoDate(DATE_RANGE.max)).not.toBeNull();
    expect(parseIsoDate('1899-12-31')).toBeNull();
    expect(parseIsoDate('2101-01-01')).toBeNull();
    // Tahun setengah jadi waktu ngetik di input tanggal
    expect(parseIsoDate('0002-01-10')).toBeNull();
  });

  it('tanggal yang gak ada di kalender dan format lain ditolak', () => {
    for (const value of ['2027-02-29', '2027-04-31', '2027-13-01', '2027-1-5', '', '10/01/2027', null, undefined, 20270110]) {
      expect(parseIsoDate(value)).toBeNull();
    }
  });

  it('isoDate kebalikan parseIsoDate, dan tanggal yang dipilih jadi tanggal di toolbar', () => {
    expect(isoDate(new Date(2027, 0, 10))).toBe('2027-01-10');
    const { year, month, date } = parseIsoDate('2031-07-04');
    expect(isoDate(simDate(daysFromStart(year, month, date) + 0.5))).toBe('2031-07-04');
  });
});
