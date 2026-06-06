const PDFDocument = require('pdfkit');

const COMPANY_NAME = 'NANDINI HERBAL CARE PVT. LTD.';

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount) {
  return (Math.round(toNumber(amount) * 100) / 100).toFixed(2);
}

function numberToWords(num) {
  if (num === 0) return 'Zero Only';
  if (num < 0) return `Minus ${numberToWords(Math.abs(num))}`;

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
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

function generateSalarySlipPDF(employeeRecord, periodRecord) {
  const employee = getPlainRecord(employeeRecord);
  const period = getPlainRecord(periodRecord);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 80;
    const leftMargin = 40;

    doc.fontSize(16).font('Helvetica-Bold').text(COMPANY_NAME, leftMargin, 40, {
      align: 'center',
      width: pageWidth,
    });

    doc.fontSize(10).font('Helvetica').text('Salary Slip', leftMargin, 60, {
      align: 'center',
      width: pageWidth,
    });

    doc.fontSize(11).font('Helvetica-Bold').text(`Month: ${period.label}`, leftMargin, 78, {
      align: 'center',
      width: pageWidth,
    });

    doc.moveTo(leftMargin, 95).lineTo(leftMargin + pageWidth, 95).stroke();

    let y = 108;
    doc.fontSize(9).font('Helvetica-Bold');

    const col1 = leftMargin;
    const col2 = leftMargin + 130;
    const col3 = leftMargin + pageWidth / 2 + 10;
    const col4 = leftMargin + pageWidth / 2 + 130;

    doc.text('Employee Name:', col1, y);
    doc.font('Helvetica').text(employee.employeeName, col2, y);
    doc.font('Helvetica-Bold').text('Designation:', col3, y);
    doc.font('Helvetica').text(String(employee.post || ''), col4, y);

    y += 18;
    doc.font('Helvetica-Bold').text('Department:', col1, y);
    doc.font('Helvetica').text(String(employee.departmentGroup || ''), col2, y);
    doc.font('Helvetica-Bold').text('PF Status:', col3, y);
    doc.font('Helvetica').text(String(employee.pfStatus || 'N/A'), col4, y);

    y += 18;
    doc.font('Helvetica-Bold').text('UAN No.:', col1, y);
    doc.font('Helvetica').text(String(employee.uanNumber || 'N/A'), col2, y);
    doc.font('Helvetica-Bold').text('PAN:', col3, y);
    doc.font('Helvetica').text(String(employee.pan || 'N/A'), col4, y);

    y += 18;
    doc.font('Helvetica-Bold').text('CTC (Monthly):', col1, y);
    doc.font('Helvetica').text(`Rs. ${formatCurrency(employee.salaryAmount)}`, col2, y);
    doc.font('Helvetica-Bold').text('Bank A/C:', col3, y);
    doc.font('Helvetica').text(String(employee.bankAccount || 'N/A'), col4, y);

    y += 25;
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();

    y += 10;
    doc.fontSize(10).font('Helvetica-Bold').text('ATTENDANCE', leftMargin, y, {
      align: 'center',
      width: pageWidth,
    });

    y += 18;
    const attCol1 = leftMargin + 20;
    const attCol2 = leftMargin + 140;
    const attCol3 = leftMargin + 260;
    const attCol4 = leftMargin + 380;

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Present Days:', attCol1, y);
    doc.font('Helvetica').text(String(employee.presentDays || 0), attCol2, y);
    doc.font('Helvetica-Bold').text('Week Off:', attCol3, y);
    doc.font('Helvetica').text(String(employee.weekOff || 0), attCol4, y);

    y += 16;
    doc.font('Helvetica-Bold').text('Other Allowance:', attCol1, y);
    doc.font('Helvetica').text(String(employee.otherAllowanceDays || 0), attCol2, y);
    doc.font('Helvetica-Bold').text('Total Days:', attCol3, y);
    doc.font('Helvetica').text(String(employee.totalDays || 0), attCol4, y);

    y += 25;
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();

    y += 10;
    const tableLeft = leftMargin;
    const tableMid = leftMargin + pageWidth / 2;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.rect(tableLeft, y, pageWidth / 2, 20).fillAndStroke('#e8e8e8', '#000000');
    doc.rect(tableMid, y, pageWidth / 2, 20).fillAndStroke('#e8e8e8', '#000000');

    doc.fillColor('black');
    doc.text('EARNINGS', tableLeft + 5, y + 5, { width: pageWidth / 2 - 10 });
    doc.text('DEDUCTIONS', tableMid + 5, y + 5, { width: pageWidth / 2 - 10 });

    y += 20;

    const earnings = [
      ['Basic', formatCurrency(employee.earningBasic || employee.basic)],
      ['HRA', formatCurrency((toNumber(employee.hra) * toNumber(employee.totalDays)) / 30)],
      ['Conveyance', formatCurrency((toNumber(employee.conveyance) * toNumber(employee.totalDays)) / 30)],
      ['Medical', formatCurrency((toNumber(employee.medical) * toNumber(employee.totalDays)) / 30)],
      ['Special Allowance', formatCurrency((toNumber(employee.specialAllowance) * toNumber(employee.totalDays)) / 30)],
      ['Other Allowance', formatCurrency(employee.otherAllowance)],
    ];

    const deductions = [
      ['PF (Employee 12%)', formatCurrency(employee.pfEmployee)],
      ['ESI (Employee 0.75%)', formatCurrency(employee.esiEmployee)],
      ['Professional Tax', formatCurrency(employee.professionalTax)],
      ['TDS', formatCurrency(employee.tds)],
      ['Advance', formatCurrency(employee.advance)],
      ['Meal', formatCurrency(employee.meal)],
      ['Store', formatCurrency(employee.store)],
      ['Other', formatCurrency(employee.otherDeduction)],
    ];

    const maxRows = Math.max(earnings.length, deductions.length);
    doc.fontSize(9).font('Helvetica');

    for (let i = 0; i < maxRows; i += 1) {
      const rowHeight = 16;

      if (i < earnings.length) {
        doc.text(earnings[i][0], tableLeft + 5, y + 3);
        doc.text(`Rs. ${earnings[i][1]}`, tableLeft + pageWidth / 2 - 85, y + 3, {
          width: 80,
          align: 'right',
        });
      }

      if (i < deductions.length) {
        doc.text(deductions[i][0], tableMid + 5, y + 3);
        doc.text(`Rs. ${deductions[i][1]}`, tableMid + pageWidth / 2 - 85, y + 3, {
          width: 80,
          align: 'right',
        });
      }

      y += rowHeight;
    }

    y += 5;
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
    y += 5;

    const totalDeduction =
      toNumber(employee.pfEmployee) +
      toNumber(employee.esiEmployee) +
      toNumber(employee.professionalTax) +
      toNumber(employee.tds) +
      toNumber(employee.advance) +
      toNumber(employee.meal) +
      toNumber(employee.store) +
      toNumber(employee.otherDeduction);

    doc.font('Helvetica-Bold');
    doc.text('Gross Earnings:', tableLeft + 5, y + 3);
    doc.text(`Rs. ${formatCurrency(employee.gross)}`, tableLeft + pageWidth / 2 - 85, y + 3, {
      width: 80,
      align: 'right',
    });
    doc.text('Total Deductions:', tableMid + 5, y + 3);
    doc.text(`Rs. ${formatCurrency(totalDeduction)}`, tableMid + pageWidth / 2 - 85, y + 3, {
      width: 80,
      align: 'right',
    });

    y += 30;
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
    y += 8;

    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`NET SALARY: Rs. ${formatCurrency(employee.netAmount)}`, leftMargin, y, {
      align: 'center',
      width: pageWidth,
    });

    y += 25;
    doc.fontSize(9).font('Helvetica');
    doc.text(`(${numberToWords(Math.round(toNumber(employee.netAmount)))})`, leftMargin, y, {
      align: 'center',
      width: pageWidth,
    });

    y += 50;
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).stroke();
    y += 10;

    doc.fontSize(8).font('Helvetica');
    doc.text('This is a computer-generated salary slip and does not require a signature.', leftMargin, y, {
      align: 'center',
      width: pageWidth,
    });

    if (toNumber(employee.pfEmployer) > 0 || toNumber(employee.esiEmployer) > 0) {
      y += 20;
      doc.fontSize(7).font('Helvetica');
      doc.text(
        `Employer Contribution - PF (13%): Rs. ${formatCurrency(employee.pfEmployer)} | ESI (3.25%): Rs. ${formatCurrency(employee.esiEmployer)}`,
        leftMargin,
        y,
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
