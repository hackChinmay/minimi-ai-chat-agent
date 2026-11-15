export interface ResolvedTemporalInfo {
  raw: string;
  extractedYear?: number;
  targetPeriod?: string;
  isRelative: boolean;
  isValid: boolean;
  normalizedDate?: string;
}

export class TemporalResolver {
  /**
   * Resolves explicit or relative temporal expressions into structured date/period metadata.
   */
  public resolve(input: string, referenceDate: Date = new Date()): ResolvedTemporalInfo {
    const raw = input.trim();
    if (!raw) {
      return { raw: '', isRelative: false, isValid: false };
    }

    const currentYear = referenceDate.getUTCFullYear();
    const lower = raw.toLowerCase();

    // 1. Explicit ISO Date (YYYY-MM-DD)
    const isoMatch = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);

      if (this.isValidCalendarDate(year, month, day)) {
        return {
          raw,
          extractedYear: year,
          targetPeriod: isoMatch[0],
          isRelative: false,
          isValid: true,
          normalizedDate: new Date(Date.UTC(year, month - 1, day)).toISOString(),
        };
      } else {
        return { raw, isRelative: false, isValid: false };
      }
    }

    // 2. Month and Year (e.g., "October 2022", "Sept 2023", "November 2026")
    const monthYearMatch = lower.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})\b/i
    );
    if (monthYearMatch && monthYearMatch[1] && monthYearMatch[2]) {
      const year = parseInt(monthYearMatch[2], 10);
      if (this.isValidYear(year)) {
        return {
          raw,
          extractedYear: year,
          targetPeriod: `${monthYearMatch[1]} ${year}`,
          isRelative: false,
          isValid: true,
          normalizedDate: `${year}-${this.getMonthNumber(monthYearMatch[1])}-01T00:00:00.000Z`,
        };
      }
    }

    // 3. Relative: "since YYYY"
    const sinceMatch = lower.match(/\bsince\s+(\d{4})\b/);
    if (sinceMatch && sinceMatch[1]) {
      const year = parseInt(sinceMatch[1], 10);
      return {
        raw,
        extractedYear: year,
        targetPeriod: `since ${year}`,
        isRelative: true,
        isValid: this.isValidYear(year),
        normalizedDate: `${year}-01-01T00:00:00.000Z`,
      };
    }

    // 4. Relative: "last year" / "previous year"
    if (/\b(last|previous)\s+year\b/i.test(lower)) {
      const targetYear = currentYear - 1;
      return {
        raw,
        extractedYear: targetYear,
        targetPeriod: `${targetYear}`,
        isRelative: true,
        isValid: true,
        normalizedDate: `${targetYear}-01-01T00:00:00.000Z`,
      };
    }

    // 5. Relative: "this year" / "current year"
    if (/\b(this|current)\s+year\b/i.test(lower)) {
      return {
        raw,
        extractedYear: currentYear,
        targetPeriod: `${currentYear}`,
        isRelative: true,
        isValid: true,
        normalizedDate: `${currentYear}-01-01T00:00:00.000Z`,
      };
    }

    // 6. Relative: "N years ago"
    const yearsAgoMatch = lower.match(/\b(\d+)\s+years?\s+ago\b/);
    if (yearsAgoMatch && yearsAgoMatch[1]) {
      const yearsAgo = parseInt(yearsAgoMatch[1], 10);
      const targetYear = currentYear - yearsAgo;
      return {
        raw,
        extractedYear: targetYear,
        targetPeriod: `${targetYear}`,
        isRelative: true,
        isValid: this.isValidYear(targetYear),
        normalizedDate: `${targetYear}-01-01T00:00:00.000Z`,
      };
    }

    // 7. Explicit Calendar Year (1900 - 2099)
    const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch && yearMatch[1]) {
      const year = parseInt(yearMatch[1], 10);
      if (this.isValidYear(year)) {
        return {
          raw,
          extractedYear: year,
          targetPeriod: `${year}`,
          isRelative: false,
          isValid: true,
          normalizedDate: `${year}-01-01T00:00:00.000Z`,
        };
      }
    }

    // 8. Relative: "yesterday"
    if (/\byesterday\b/i.test(lower)) {
      const yesterday = new Date(referenceDate);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const iso = yesterday.toISOString().split('T')[0];
      return {
        raw,
        extractedYear: yesterday.getUTCFullYear(),
        targetPeriod: iso,
        isRelative: true,
        isValid: true,
        normalizedDate: yesterday.toISOString(),
      };
    }

    // 9. Relative: "today" / "now" / "currently"
    if (/\b(today|now|currently)\b/i.test(lower)) {
      const iso = referenceDate.toISOString().split('T')[0];
      return {
        raw,
        extractedYear: currentYear,
        targetPeriod: iso,
        isRelative: true,
        isValid: true,
        normalizedDate: referenceDate.toISOString(),
      };
    }

    // Unrecognized or invalid
    return {
      raw,
      isRelative: false,
      isValid: false,
    };
  }

  private isValidYear(year: number): boolean {
    return Number.isInteger(year) && year >= 1800 && year <= 2100;
  }

  private isValidCalendarDate(year: number, month: number, day: number): boolean {
    if (!this.isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  }

  private getMonthNumber(monthStr: string): string {
    const map: Record<string, string> = {
      jan: '01', january: '01',
      feb: '02', february: '02',
      mar: '03', march: '03',
      apr: '04', april: '04',
      may: '05',
      jun: '06', june: '06',
      jul: '07', july: '07',
      aug: '08', august: '08',
      sep: '09', sept: '09', september: '09',
      oct: '10', october: '10',
      nov: '11', november: '11',
      dec: '12', december: '12',
    };
    return map[monthStr.toLowerCase()] || '01';
  }
}

export const temporalResolver = new TemporalResolver();
