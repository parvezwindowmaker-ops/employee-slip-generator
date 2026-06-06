const path = require('path');
const XLSX = require('xlsx');

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_ALIASES = new Map([
  ['JAN', 1],
  ['JANUARY', 1],
  ['FEB', 2],
  ['FEBRUARY', 2],
  ['MAR', 3],
  ['MARCH', 3],
  ['APR', 4],
  ['APRIL', 4],
  ['MAY', 5],
  ['JUN', 6],
  ['JUNE', 6],
  ['JUL', 7],
  ['JULY', 7],
  ['AUG', 8],
  ['AUGUST', 8],
  ['SEP', 9],
  ['SEPT', 9],
  ['SEPTEMBER', 9],
  ['OCT', 10],
  ['OCTOBER', 10],
  ['NOV', 11],
  ['NOVEMBER', 11],
  ['DEC', 12],
  ['DECEMBER', 12],
]);

/* ─── Sheet names that should be skipped (non-payroll sheets) ─── */
const SKIP_SHEET_PATTERNS = [
  /\bleft\b/i,
  /\bterminated?\b/i,
  /\bresigned?\b/i,
  /\bsummary\b/i,
  /\bmaster\b/i,
  /\bindex\b/i,
  /\btrail\s*sheet\b/i,
  /\bsheet\s*\d+$/i,     // generic "Sheet1", "Sheet2" etc.
];

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value) {
  const parsed = Math.trunc(toNumber(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeYear(value) {
  const parsed = toInteger(value);
  if (!parsed) return null;
  if (parsed < 100) return 2000 + parsed;
  return parsed;
}

function normalizeMonth(value) {
  if (!value) return null;
  const numeric = toInteger(value);
  if (numeric >= 1 && numeric <= 12) return numeric;

  const key = cleanText(value).toUpperCase().replace(/[^A-Z]/g, '');
  return MONTH_ALIASES.get(key) || null;
}

function periodLabel(month, year) {
  return `${MONTHS[month - 1]} ${year}`;
}

function detectPeriodFromText(text) {
  const normalized = cleanText(text).toUpperCase().replace(/[._]+/g, ' ');
  if (!normalized) return null;

  const monthPattern = Array.from(MONTH_ALIASES.keys()).join('|');
  const monthThenYear = new RegExp(`\\b(${monthPattern})\\b\\D{0,12}(\\d{2,4})\\b`);
  const yearThenMonth = new RegExp(`\\b(\\d{2,4})\\b\\D{0,12}(${monthPattern})\\b`);

  const firstMatch = normalized.match(monthThenYear);
  if (firstMatch) {
    return {
      month: normalizeMonth(firstMatch[1]),
      year: normalizeYear(firstMatch[2]),
    };
  }

  const secondMatch = normalized.match(yearThenMonth);
  if (secondMatch) {
    return {
      month: normalizeMonth(secondMatch[2]),
      year: normalizeYear(secondMatch[1]),
    };
  }

  return null;
}

function detectPeriod(rows, sheetName, fileName, overrides = {}) {
  const overrideMonth = normalizeMonth(overrides.month);
  const overrideYear = normalizeYear(overrides.year);

  if (overrideMonth && overrideYear) {
    return {
      month: overrideMonth,
      year: overrideYear,
      label: periodLabel(overrideMonth, overrideYear),
    };
  }

  const candidates = [
    sheetName,
    path.basename(fileName || '', path.extname(fileName || '')),
  ];

  rows.slice(0, 8).forEach((row) => {
    row.forEach((cell) => candidates.push(cell));
  });

  for (const candidate of candidates) {
    const detected = detectPeriodFromText(candidate);
    if (detected?.month && detected?.year) {
      return {
        month: detected.month,
        year: detected.year,
        label: periodLabel(detected.month, detected.year),
      };
    }
  }

  return null;
}

function isPfEligible(pfStatus) {
  const value = cleanText(pfStatus).toUpperCase();
  if (!value || ['NO', 'N', 'NA', 'N/A', 'NON PF'].includes(value)) return false;
  return value.includes('PF') || value.includes('YES') || value === 'Y';
}

function rowToEmployee(row) {
  const serialNumber = toInteger(row[9]);
  const employeeName = cleanText(row[11]);

  if (!serialNumber || !employeeName || employeeName.toUpperCase() === 'TOTAL') {
    return null;
  }

  const pfStatus = cleanText(row[10]);

  return {
    serialNumber,
    employeeName,
    departmentGroup: cleanText(row[4]),
    post: cleanText(row[5]),
    status: cleanText(row[6]),
    pfStatus,
    pfEligible: isPfEligible(pfStatus),
    uanNumber: cleanText(row[8]),
    salaryAmount: toNumber(row[12]),
    basic: toNumber(row[13]),
    hra: toNumber(row[14]),
    conveyance: toNumber(row[15]),
    medical: toNumber(row[16]),
    specialAllowance: toNumber(row[17]),
    totalEarningsFixed: toNumber(row[18]),
    pfSalary: toNumber(row[19]),
    presentDays: toNumber(row[20]),
    weekOff: toNumber(row[21]),
    otherAllowanceDays: toNumber(row[22]),
    totalDays: toNumber(row[23]),
    earnedTotal: toNumber(row[24]),
    otherAllowance: toNumber(row[25]),
    gross: toNumber(row[26]),
    earningBasic: toNumber(row[27]),
    pfEmployee: toNumber(row[28]),
    pfEmployer: toNumber(row[29]),
    esiEmployee: toNumber(row[30]),
    esiEmployer: toNumber(row[31]),
    professionalTax: toNumber(row[32]),
    tds: toNumber(row[33]),
    advance: toNumber(row[34]),
    meal: toNumber(row[35]),
    store: toNumber(row[36]),
    otherDeduction: toNumber(row[37]),
    totalDeductions: toNumber(row[38]),
    netAmount: toNumber(row[39]),
    aadhar: cleanText(row[41]),
    pan: cleanText(row[42]),
    bankAccount: cleanText(row[43]),
    ifsc: cleanText(row[44]),
    mobile: cleanText(row[45]),
    rawData: row,
  };
}

/**
 * Checks whether a sheet name looks like a non-payroll sheet that should be skipped.
 */
function shouldSkipSheet(sheetName) {
  const name = cleanText(sheetName);
  if (!name) return true;
  return SKIP_SHEET_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Parses a single sheet and returns { period, employees } or null if the sheet
 * has no valid employee data or cannot determine its period.
 */
function parseSingleSheet(workbook, sheetName, fileName, overrides = {}) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length === 0) return null;

  const period = detectPeriod(rows, sheetName, fileName, overrides);
  if (!period) return null;

  const employees = rows.map(rowToEmployee).filter(Boolean);
  if (employees.length === 0) return null;

  return { period, employees };
}

/**
 * Parses a workbook that may contain multiple sheets, each representing a different
 * payroll month. Returns an array of { period, employees } objects.
 *
 * When month/year overrides are provided, only the first valid payroll sheet is used
 * (since the override applies to a single period).
 *
 * When no overrides are provided, every sheet that contains a detectable month/year
 * and valid employee rows is included.
 *
 * @param {Buffer} buffer - The XLSX file buffer
 * @param {string} fileName - Original filename (used for period detection)
 * @param {object} overrides - Optional { month, year } overrides
 * @returns {{ results: Array<{ period, employees }>, skippedSheets: string[], errors: string[] }}
 */
function parsePayrollWorkbook(buffer, fileName, overrides = {}) {
  let workbook;

  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (readError) {
    throw new Error(
      `Failed to read the XLSX file. The file may be corrupted or in an unsupported format. (${readError.message})`
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded workbook does not contain any sheets.');
  }

  const hasOverrides = normalizeMonth(overrides.month) && normalizeYear(overrides.year);
  const results = [];
  const skippedSheets = [];
  const deferredSheets = [];
  const errors = [];
  const seenPeriods = new Map(); // "month-year" → index in results

  function processSheet(sheetName) {
    try {
      const parsed = parseSingleSheet(
        workbook,
        sheetName,
        fileName,
        hasOverrides ? overrides : {},
      );

      if (!parsed) {
        skippedSheets.push(sheetName);
        return false;
      }

      const periodKey = `${parsed.period.month}-${parsed.period.year}`;

      // If this period already appeared in another sheet, merge employees
      if (seenPeriods.has(periodKey)) {
        const existingIndex = seenPeriods.get(periodKey);
        const existing = results[existingIndex];

        // Merge: add new employees, skip duplicates by serialNumber
        const existingSerials = new Set(existing.employees.map((e) => e.serialNumber));
        for (const emp of parsed.employees) {
          if (!existingSerials.has(emp.serialNumber)) {
            existing.employees.push(emp);
            existingSerials.add(emp.serialNumber);
          }
        }
      } else {
        seenPeriods.set(periodKey, results.length);
        results.push(parsed);
      }

      return true;
    } catch (sheetError) {
      errors.push(`Sheet "${sheetName}": ${sheetError.message}`);
      return false;
    }
  }

  // First pass: process sheets that don't look like non-payroll data
  for (const sheetName of workbook.SheetNames) {
    if (shouldSkipSheet(sheetName)) {
      deferredSheets.push(sheetName);
      continue;
    }

    const found = processSheet(sheetName);

    // If overrides were provided, only process the first valid sheet
    if (found && hasOverrides) break;
  }

  // Second pass: if no results yet, try the deferred sheets as a fallback.
  // This handles workbooks where the only sheet has a generic name like "Sheet1".
  if (results.length === 0 && deferredSheets.length > 0) {
    for (const sheetName of deferredSheets) {
      const found = processSheet(sheetName);
      if (found && hasOverrides) break;
    }
    // Any deferred sheets not processed in the second pass are considered skipped
  } else {
    // First pass found results — deferred sheets are truly skipped
    skippedSheets.push(...deferredSheets);
  }

  if (results.length === 0) {
    if (errors.length > 0) {
      throw new Error(
        `No valid payroll data found. Errors encountered:\n${errors.join('\n')}`
      );
    }
    throw new Error(
      'No valid payroll data found in the uploaded file. ' +
      'Ensure the workbook contains at least one sheet with employee salary data ' +
      'and a detectable month/year (in the sheet name, title row, or filename). ' +
      `Sheets found: ${workbook.SheetNames.join(', ')}`
    );
  }

  return { results, skippedSheets, errors };
}

module.exports = {
  MONTHS,
  parsePayrollWorkbook,
  periodLabel,
};
