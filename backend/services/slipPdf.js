const PDFDocument = require('pdfkit');

const COMPANY_NAME = 'NANDINI HERBAL CARE PVT. LTD.';

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount) {
  return Number(Math.round(toNumber(amount) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberToWords(num) {
  if (num === 0) return 'Zero Only';
  if (num < 0) return `Minus ${numberToWords(Math.abs(num))}`;

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ` ${convert(n % 100)}` : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ` ${convert(n % 1000)}` : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ` ${convert(n % 100000)}` : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ` ${convert(n % 10000000)}` : '');
  }

  return `Rupees ${convert(Math.round(num))} Only`;
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

/**
 * Accepts either a Buffer or a base64 data URL string and returns a Buffer that
 * PDFKit can embed, or null when the input is missing/unrecognized.
 */
function normalizeSignature(signature) {
  if (!signature) return null;
  if (Buffer.isBuffer(signature)) return signature;

  if (typeof signature === 'string') {
    const match = signature.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
    if (match) {
      try {
        return Buffer.from(match[1], 'base64');
      } catch {
        return null;
      }
    }
  }

  return null;
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

  const signatureBuffer = options.includeSignature ? normalizeSignature(options.signature) : null;
  const includeSignature = Boolean(signatureBuffer);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const leftMargin = 40;
    const rightMargin = 40;
    const pageWidth = doc.page.width - leftMargin - rightMargin;
    
    // Top Accent Bar (Emerald color)
    doc.rect(0, 0, doc.page.width, 8).fill('#047857');

    // Header
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#064e3b').text(COMPANY_NAME, leftMargin, 45, {
      align: 'center',
      width: pageWidth,
    });

    doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('S-201, SIGNATURE COMPLEX, ZYDUS HOSPITAL ROAD, THALTEJ, AHMEDABAD 380059', leftMargin, 70, {
      align: 'center',
      width: pageWidth,
    });

    // Salary Slip Title Pill
    doc.roundedRect(leftMargin + pageWidth / 2 - 80, 100, 160, 26, 13).fill('#ecfdf5');
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text('SALARY SLIP', leftMargin, 108, {
      align: 'center',
      width: pageWidth,
    });

    let y = 145;

    // Employee Details Section
    doc.roundedRect(leftMargin, y, pageWidth, 68, 6).fill('#f8fafc');
    doc.roundedRect(leftMargin, y, pageWidth, 68, 6).stroke('#cbd5e1');
    
    // Left side details
    const col1X = leftMargin + 15;
    const col2X = leftMargin + 105;
    const col3X = leftMargin + pageWidth / 2 + 15;
    const col4X = leftMargin + pageWidth / 2 + 105;

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569');
    doc.text('Employee Name:', col1X, y + 16);
    doc.font('Helvetica').fillColor('#0f172a').text(employee.employeeName || '-', col2X, y + 16, { width: pageWidth / 2 - 130, lineBreak: false, ellipsis: true });

    doc.font('Helvetica-Bold').fillColor('#475569').text('Designation:', col1X, y + 40);
    doc.font('Helvetica').fillColor('#0f172a').text(String(employee.post || '-'), col2X, y + 40, { width: pageWidth / 2 - 130, lineBreak: false, ellipsis: true });

    // Right side details
    doc.font('Helvetica-Bold').fillColor('#475569').text('Month & Year:', col3X, y + 16);
    doc.font('Helvetica').fillColor('#0f172a').text(String(period.label || '-'), col4X, y + 16, { width: pageWidth / 2 - 130, lineBreak: false, ellipsis: true });

    const leaves = Math.max(0, toNumber(employee.totalDays) - toNumber(employee.presentDays) - toNumber(employee.weekOff) - toNumber(employee.otherAllowanceDays));
    
    doc.font('Helvetica-Bold').fillColor('#475569').text('Days / Leaves:', col3X, y + 40);
    doc.font('Helvetica').fillColor('#0f172a').text(`${employee.totalDays || 0}  /  ${leaves}`, col4X, y + 40);

    y += 95;

    // Salary Details Table
    const tableLeft = leftMargin;
    const tableMid = leftMargin + pageWidth / 2;
    const tableRight = leftMargin + pageWidth;
    
    const headerHeight = 28;
    const rowHeight = 24;
    const totalsHeight = 28;
    
    const amountColWidth = 90;
    const nameColWidth = pageWidth / 2 - amountColWidth;

    const earnings = [
      ['Basic', employee.earningBasic || employee.basic],
      ['H.R.A', (toNumber(employee.hra) * toNumber(employee.totalDays)) / 30],
      ['Conveyance', (toNumber(employee.conveyance) * toNumber(employee.totalDays)) / 30],
      ['Medical', (toNumber(employee.medical) * toNumber(employee.totalDays)) / 30],
    ];

    let incentiveVal = toNumber(employee.otherAllowance || employee.specialAllowance || 0);
    if (incentiveVal > 0) {
      earnings.push(['Incentive', incentiveVal]);
    }

    const deductions = [
      ['Provident Fund', employee.pfEmployee],
      ['E.S.I.', employee.esiEmployee],
      ['Professional Tax', employee.professionalTax],
      ['Loan / Advance', employee.advance],
      ['TDS / IT', employee.tds],
    ];

    const maxRows = Math.max(earnings.length, deductions.length);
    const tableBottom = y + headerHeight + (maxRows * rowHeight) + totalsHeight;

    // 1. Draw Backgrounds First
    // Header Background
    doc.rect(tableLeft, y, pageWidth, headerHeight).fill('#047857');

    // Rows Background
    let currentY = y + headerHeight;
    for (let i = 0; i < maxRows; i++) {
      if (i % 2 !== 0) {
        doc.rect(tableLeft, currentY, pageWidth, rowHeight).fill('#f8fafc');
      }
      currentY += rowHeight;
    }

    // Totals Row Background
    doc.rect(tableLeft, currentY, pageWidth, totalsHeight).fill('#f1f5f9');

    // 2. Draw Text
    // Header Text
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('EARNINGS', tableLeft + 12, y + 9);
    doc.text('AMOUNT', tableLeft + nameColWidth, y + 9, { width: amountColWidth - 12, align: 'right' });

    doc.text('DEDUCTIONS', tableMid + 12, y + 9);
    doc.text('AMOUNT', tableMid + nameColWidth, y + 9, { width: amountColWidth - 12, align: 'right' });

    // Rows Text
    currentY = y + headerHeight;
    for (let i = 0; i < maxRows; i++) {
      if (i < earnings.length) {
        doc.font('Helvetica').fillColor('#334155').text(earnings[i][0], tableLeft + 12, currentY + 7, { width: nameColWidth - 20, lineBreak: false, ellipsis: true });
        let val = toNumber(earnings[i][1]);
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(val === 0 ? '-' : formatCurrency(val), tableLeft + nameColWidth, currentY + 7, { width: amountColWidth - 12, align: 'right' });
      }

      if (i < deductions.length) {
        doc.font('Helvetica').fillColor('#334155').text(deductions[i][0], tableMid + 12, currentY + 7, { width: nameColWidth - 20, lineBreak: false, ellipsis: true });
        let val = toNumber(deductions[i][1]);
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(val === 0 ? '-' : formatCurrency(val), tableMid + nameColWidth, currentY + 7, { width: amountColWidth - 12, align: 'right' });
      }

      currentY += rowHeight;
    }

    // Totals Text
    doc.font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Total Earnings', tableLeft + 12, currentY + 9);
    doc.text(formatCurrency(employee.gross), tableLeft + nameColWidth, currentY + 9, { width: amountColWidth - 12, align: 'right' });

    const totalDeductions = deductions.reduce((sum, item) => sum + toNumber(item[1]), 0);
    doc.text('Total Deductions', tableMid + 12, currentY + 9);
    doc.text(formatCurrency(totalDeductions), tableMid + nameColWidth, currentY + 9, { width: amountColWidth - 12, align: 'right' });

    // 3. Draw Grid Lines Over Everything (to ensure crisp borders)
    
    // Outer Table Border
    doc.rect(tableLeft, y, pageWidth, tableBottom - y).stroke('#cbd5e1');
    
    // Horizontal Lines between rows
    let lineY = y + headerHeight;
    for (let i = 0; i <= maxRows; i++) {
      doc.moveTo(tableLeft, lineY).lineTo(tableRight, lineY).stroke('#cbd5e1');
      lineY += rowHeight;
    }

    // Vertical Divider - Center
    doc.moveTo(tableMid, y).lineTo(tableMid, y + headerHeight).stroke('#059669'); // header divider
    doc.moveTo(tableMid, y + headerHeight).lineTo(tableMid, tableBottom).stroke('#cbd5e1'); // body divider

    // Vertical Dividers - Amount Columns
    doc.moveTo(tableLeft + nameColWidth, y).lineTo(tableLeft + nameColWidth, y + headerHeight).stroke('#059669'); // header divider
    doc.moveTo(tableLeft + nameColWidth, y + headerHeight).lineTo(tableLeft + nameColWidth, tableBottom).stroke('#cbd5e1'); // body divider

    doc.moveTo(tableMid + nameColWidth, y).lineTo(tableMid + nameColWidth, y + headerHeight).stroke('#059669'); // header divider
    doc.moveTo(tableMid + nameColWidth, y + headerHeight).lineTo(tableMid + nameColWidth, tableBottom).stroke('#cbd5e1'); // body divider

    y = tableBottom + 45;

    // Amount in Words
    doc.font('Helvetica').fontSize(10).fillColor('#64748b');
    doc.text('Net Pay in words:', leftMargin, y);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(numberToWords(toNumber(employee.netAmount)), leftMargin, y + 16, { width: pageWidth - 200, lineBreak: true });

    // Net Pay Box
    const netBoxW = 180;
    const netBoxH = 55;
    const netBoxX = tableRight - netBoxW;
    const netBoxY = y - 10;

    // Premium solid box for Net Pay
    doc.roundedRect(netBoxX, netBoxY, netBoxW, netBoxH, 6).fill('#064e3b');
    doc.fillColor('#a7f3d0').font('Helvetica-Bold').fontSize(11).text('NET PAY', netBoxX + 15, netBoxY + 12);
    doc.fillColor('#ffffff').fontSize(18).text(`Rs. ${formatCurrency(employee.netAmount)}`, netBoxX + 15, netBoxY + 28, { align: 'left' });

    y += 90;

    // Signature area (Authorized Signatory only — employee signature removed)
    const sigBlockW = 160;
    const sigBlockX = tableRight - sigBlockW;

    if (includeSignature) {
      // Draw the uploaded signature image above the line, centered in the block
      const imgMaxW = 130;
      const imgMaxH = 48;
      try {
        doc.image(signatureBuffer, sigBlockX + (sigBlockW - imgMaxW) / 2, y - imgMaxH - 2, {
          fit: [imgMaxW, imgMaxH],
          align: 'center',
          valign: 'bottom',
        });
      } catch {
        // If the image can't be embedded, fall back to just the line + label
      }

      doc.fillColor('#0f172a');
      doc.moveTo(sigBlockX, y).lineTo(tableRight, y).stroke('#cbd5e1');
      doc.fontSize(10).font('Helvetica-Bold').text('Authorized Signatory', sigBlockX, y + 8, {
        width: sigBlockW,
        align: 'center',
      });
    } else {
      // No signature requested — note that the slip is computer generated
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748b').text(
        'This is a computer-generated salary slip and does not require a signature.',
        leftMargin,
        y + 6,
        { align: 'center', width: pageWidth },
      );
    }

    doc.end();
  });
}

module.exports = {
  createSlipFilename,
  generateSalarySlipPDF,
  sanitizeFilename,
};
