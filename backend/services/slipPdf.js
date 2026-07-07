const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const COMPANY_NAME = 'Nandini Herbal Care Pvt. Ltd.';

/*
 * NOTE ON FORMAT VALIDITY
 * -----------------------
 * The layout in this file matches the payroll Excel format / slip policy used
 * THROUGH MAY 2026. From June 2026 onward the Excel columns and the slip policy
 * change, which will need a new template. Until that new format is finalised we
 * render every period with this template. `isWithinLegacyFormat(period)` is
 * provided so a future renderer can be branched in cleanly inside
 * generateSalarySlipPDF without touching the rest of the code.
 */
const FORMAT_VALID_THROUGH = { year: 2026, month: 5 }; // May 2026

function isWithinLegacyFormat(period) {
  const year = Number(period?.year);
  const month = Number(period?.month);
  if (!year || !month) return true; // unknown period → assume current template
  return (
    year < FORMAT_VALID_THROUGH.year ||
    (year === FORMAT_VALID_THROUGH.year && month <= FORMAT_VALID_THROUGH.month)
  );
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount) {
  return Number(Math.round(toNumber(amount) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Currency for table cells: blank-looking dash when zero (rows are filtered, but
// Basic is always shown so it may legitimately be 0).
function cellAmount(amount) {
  return toNumber(amount) === 0 ? '-' : formatCurrency(amount);
}

function numberToWords(num) {
  const value = Math.round(toNumber(num));
  if (value === 0) return 'Rupees Zero Only';
  if (value < 0) return `Minus ${numberToWords(Math.abs(value))}`;

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : '');
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${convert(n % 100)}` : ''}`;
    if (n < 100000) return `${convert(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${convert(n % 1000)}` : ''}`;
    if (n < 10000000) return `${convert(Math.floor(n / 100000))} Lakh${n % 100000 ? ` ${convert(n % 100000)}` : ''}`;
    return `${convert(Math.floor(n / 10000000))} Crore${n % 10000000 ? ` ${convert(n % 10000000)}` : ''}`;
  }

  return `Rupees ${convert(value)} Only`;
}

function sanitizeFilename(name) {
  return String(name || 'salary-slip')
    .replace(/[^a-zA-Z0-9.\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function createSlipFilename(employee, period) {
  const monthYear = `${String(period.label || `${period.month}-${period.year}`).replace(/\s+/g, '-')}`;
  return `${sanitizeFilename(employee.employeeName)}_Salary_Slip_${monthYear}.pdf`;
}

function getPlainRecord(record) {
  return typeof record.toJSON === 'function' ? record.toJSON() : record;
}

// Returns the first existing company logo (PNG/JPEG — the formats PDFKit supports)
// from backend/public, or null if none is present.
function resolveLogoPath() {
  const publicDir = path.join(__dirname, '..', 'public');
  const candidates = ['logo.png', 'logo.jpg', 'logo.jpeg'];
  for (const name of candidates) {
    const candidate = path.join(publicDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function normalizeSignature(signature) {
  if (!signature) return null;
  if (Buffer.isBuffer(signature)) return signature;
  if (typeof signature === 'string') {
    const match = signature.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
    if (match) {
      try { return Buffer.from(match[1], 'base64'); } catch { return null; }
    }
  }
  return null;
}

/**
 * Salary slip template valid through May 2026.
 *
 * @param {object} employee - plain salary-slip record (mirrors the Excel columns)
 * @param {object} period - plain payroll-period record
 * @param {object} options - { includeSignature, signature }
 */
function renderSlipThroughMay2026(employee, period, options) {
  const signatureBuffer = options.includeSignature ? normalizeSignature(options.signature) : null;
  const includeSignature = Boolean(signatureBuffer);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 30;
    const pageW = doc.page.width - left * 2;
    const rightX = left + pageW;
    const border = '#9aa3ad';

    // ───────────────────────── Header ─────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text(COMPANY_NAME, left, 32);
    doc.fontSize(8).font('Helvetica').fillColor('#4b5563');
    doc.text('S-201, Signature Complex, Nr. Zydus Hospital, Hebatpur Road,', left, 50);
    doc.text('Thaltej, Ahmedabad - 380054, Gujarat, India', left, 61);
    doc.text('info@nandiniherbalcare.com   |   +91 99988 74048', left, 72);

    const logoPath = resolveLogoPath();
    let logoEmbedded = false;
    if (logoPath) {
      try {
        const logoW = 155;
        const logoH = 58;
        doc.image(logoPath, rightX - logoW, 30, { fit: [logoW, logoH], align: 'right', valign: 'top' });
        logoEmbedded = true;
      } catch { /* ignore bad logo, fall back to text */ }
    }
    if (!logoEmbedded) {
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2e7d32').text('NANDINI', rightX - 150, 38, { width: 150, align: 'right' });
      doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text('HERBAL CARE', rightX - 150, 58, { width: 150, align: 'right' });
    }

    let y = 92;
    doc.lineWidth(1).strokeColor(border).moveTo(left, y).lineTo(rightX, y).stroke();

    // ───────────────────────── Title ─────────────────────────
    y += 8;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827')
      .text(`Pay Slip for ${period.label || `${period.month}/${period.year}`}`, left, y, { align: 'center', width: pageW });
    y += 22;

    const rowH = 18;

    // ─────────────────── Employee details ───────────────────
    const detailRows = [
      [['Name', employee.employeeName], ['Emp Id', employee.serialNumber || '-']],
      [['Designation', employee.post || '-'], ['Department', employee.departmentGroup || '-']],
      [['Bank A/C No', employee.bankAccount || '-'], ['UAN', employee.uanNumber || '-']],
      [['PF Status', employee.pfEligible ? 'Yes' : 'No'], ['Days (P/Total)', `${formatCurrency(employee.presentDays)} / ${formatCurrency(employee.totalDays)}`]],
    ];
    const detailColW = pageW / 2;
    const detailLabelW = 95;
    const detailTop = y;
    const detailH = rowH * detailRows.length;

    doc.lineWidth(0.8).strokeColor(border);
    doc.rect(left, detailTop, pageW, detailH).stroke();
    doc.moveTo(left + detailColW, detailTop).lineTo(left + detailColW, detailTop + detailH).stroke();

    detailRows.forEach((pair, i) => {
      const ry = detailTop + i * rowH;
      if (i > 0) doc.moveTo(left, ry).lineTo(rightX, ry).stroke();
      pair.forEach(([label, value], c) => {
        const cx = left + c * detailColW;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151')
          .text(label, cx + 6, ry + 5, { width: detailLabelW - 8, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#111827')
          .text(String(value ?? '-'), cx + detailLabelW, ry + 5, { width: detailColW - detailLabelW - 8, lineBreak: false, ellipsis: true });
      });
    });
    y = detailTop + detailH + 14;

    // ─────────────── Earnings / Deductions (real Excel fields only) ───────────────
    const presentRatio = toNumber(employee.totalDays) > 0 ? toNumber(employee.totalDays) / 30 : 1;
    const earnings = [
      ['Basic', employee.earningBasic || employee.basic],
      ['HRA', toNumber(employee.hra) * presentRatio],
      ['Conveyance', toNumber(employee.conveyance) * presentRatio],
      ['Medical', toNumber(employee.medical) * presentRatio],
      ['Special Allowance', employee.specialAllowance],
      ['Other Allowance', employee.otherAllowance],
    ].filter(([label, val]) => label === 'Basic' || toNumber(val) > 0);

    const deductions = [
      ['P.F.', employee.pfEmployee],
      ['E.S.I.', employee.esiEmployee],
      ['Professional Tax', employee.professionalTax],
      ['T.D.S.', employee.tds],
      ['Loan / Advance', employee.advance],
      ['Meal', employee.meal],
      ['Store', employee.store],
      ['Other Deduction', employee.otherDeduction],
    ].filter(([, val]) => toNumber(val) > 0);

    const half = pageW / 2;
    const amtW = 90;
    const nameW = half - amtW;
    const headH = 18;
    const bodyRowH = 16;
    const nRows = Math.max(earnings.length, deductions.length, 1);

    const earnAmtX = left + nameW;
    const dedNameX = left + half;
    const dedAmtX = left + half + nameW;

    // Header band
    doc.rect(left, y, pageW, headH).fillAndStroke('#eef2f5', border);
    doc.moveTo(dedNameX, y).lineTo(dedNameX, y + headH).strokeColor(border).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827');
    doc.text('Earnings', left + 6, y + 5, { width: nameW - 10 });
    doc.text('Amount (Rs.)', earnAmtX, y + 5, { width: amtW - 6, align: 'right' });
    doc.text('Deductions', dedNameX + 6, y + 5, { width: nameW - 10 });
    doc.text('Amount (Rs.)', dedAmtX, y + 5, { width: amtW - 6, align: 'right' });
    y += headH;

    // Body grid
    const bodyTop = y;
    const bodyH = nRows * bodyRowH;
    doc.lineWidth(0.8).strokeColor(border);
    doc.rect(left, bodyTop, pageW, bodyH).stroke();
    doc.moveTo(earnAmtX, bodyTop).lineTo(earnAmtX, bodyTop + bodyH).stroke();
    doc.moveTo(dedNameX, bodyTop).lineTo(dedNameX, bodyTop + bodyH).stroke();
    doc.moveTo(dedAmtX, bodyTop).lineTo(dedAmtX, bodyTop + bodyH).stroke();

    for (let i = 0; i < nRows; i++) {
      const ry = bodyTop + i * bodyRowH + 4;
      if (earnings[i]) {
        doc.font('Helvetica').fontSize(8).fillColor('#1f2937').text(earnings[i][0], left + 6, ry, { width: nameW - 12, lineBreak: false, ellipsis: true });
        doc.text(cellAmount(earnings[i][1]), earnAmtX, ry, { width: amtW - 6, align: 'right', lineBreak: false });
      }
      if (deductions[i]) {
        doc.font('Helvetica').fontSize(8).fillColor('#1f2937').text(deductions[i][0], dedNameX + 6, ry, { width: nameW - 12, lineBreak: false, ellipsis: true });
        doc.text(cellAmount(deductions[i][1]), dedAmtX, ry, { width: amtW - 6, align: 'right', lineBreak: false });
      }
    }
    y = bodyTop + bodyH;

    // Totals row (totals taken straight from the Excel)
    const totalDeductions = toNumber(employee.totalDeductions) || deductions.reduce((sum, d) => sum + toNumber(d[1]), 0);
    doc.rect(left, y, pageW, headH).fillAndStroke('#f3f4f6', border);
    doc.moveTo(dedNameX, y).lineTo(dedNameX, y + headH).strokeColor(border).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827');
    doc.text('Total Earnings', left + 6, y + 5, { width: nameW - 10 });
    doc.text(formatCurrency(employee.gross), earnAmtX, y + 5, { width: amtW - 6, align: 'right' });
    doc.text('Total Deductions', dedNameX + 6, y + 5, { width: nameW - 10 });
    doc.text(formatCurrency(totalDeductions), dedAmtX, y + 5, { width: amtW - 6, align: 'right' });
    y += headH;

    // Net Pay band (full width)
    doc.rect(left, y, pageW, 20).fillAndStroke('#dcfce7', border);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
    doc.text('Net Pay', left + 6, y + 6, { width: 200 });
    doc.text(`Rs. ${formatCurrency(employee.netAmount)}`, rightX - amtW - 6, y + 6, { width: amtW, align: 'right' });
    y += 20;

    // Amount in words
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#374151')
      .text(`In words: ${numberToWords(employee.netAmount)}`, left + 2, y + 6, { width: pageW - 4 });
    y += 26;

    // ─────────────── Attendance summary (compact) ───────────────
    const leaves = Math.max(0,
      toNumber(employee.totalDays) - toNumber(employee.presentDays) - toNumber(employee.weekOff) - toNumber(employee.otherAllowanceDays));
    const attendance = [
      ['Total Days', formatCurrency(employee.totalDays)],
      ['Present', formatCurrency(employee.presentDays)],
      ['Week Off', formatCurrency(employee.weekOff)],
      ['Paid Leaves', formatCurrency(leaves)],
    ];
    const attColW = pageW / attendance.length;
    const attTop = y;
    doc.lineWidth(0.8).strokeColor(border);
    doc.rect(left, attTop, pageW, rowH * 2).stroke();
    doc.moveTo(left, attTop + rowH).lineTo(rightX, attTop + rowH).stroke();
    attendance.forEach(([label, value], i) => {
      const cx = left + i * attColW;
      if (i > 0) doc.moveTo(cx, attTop).lineTo(cx, attTop + rowH * 2).stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151').text(label, cx, attTop + 5, { width: attColW, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#111827').text(String(value), cx, attTop + rowH + 5, { width: attColW, align: 'center' });
    });
    y = attTop + rowH * 2 + 28;

    // ───────────────────────── Signature ─────────────────────────
    const sigW = 170;
    const sigX = rightX - sigW;
    if (includeSignature) {
      try {
        doc.image(signatureBuffer, sigX, y, { fit: [sigW, 44], align: 'right' });
      } catch { /* ignore bad signature image */ }
      const lineY = y + 48;
      doc.lineWidth(0.8).strokeColor(border).moveTo(sigX, lineY).lineTo(rightX, lineY).stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827').text('Authorized Signatory', sigX, lineY + 4, { width: sigW, align: 'center' });
    } else {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280')
        .text('This is a computer-generated pay slip and does not require a signature.', left, y + 28, { width: pageW, align: 'right' });
    }

    // ───────────────────────── Footer ─────────────────────────
    doc.font('Helvetica').fontSize(8).fillColor('#4b5563')
      .text('(An ISO 9001:2015 Certified Company)', left, doc.page.height - 40, { align: 'center', width: pageW });

    doc.end();
  });
}

/**
 * @param {object} employeeRecord
 * @param {object} periodRecord
 * @param {object} [options]
 * @param {boolean} [options.includeSignature] - whether to print the authorized signature
 * @param {Buffer|string} [options.signature] - signature image (Buffer or base64 data URL)
 */
function generateSalarySlipPDF(employeeRecord, periodRecord, options = {}) {
  const employee = getPlainRecord(employeeRecord);
  const period = getPlainRecord(periodRecord);

  // Through May 2026 every period uses the template below. When the post-May-2026
  // Excel/policy is finalised, branch here on isWithinLegacyFormat(period) to pick
  // the appropriate renderer.
  return renderSlipThroughMay2026(employee, period, options);
}

module.exports = {
  createSlipFilename,
  generateSalarySlipPDF,
  sanitizeFilename,
  isWithinLegacyFormat,
  FORMAT_VALID_THROUGH,
};
